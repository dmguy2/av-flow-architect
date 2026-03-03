"""
LLM-based port extraction using a local Ollama model.
Manages Ollama lifecycle (start/stop) and sends product specs
to a small model for accurate I/O port identification.
"""

import subprocess
import time
import json
import re
import requests
import atexit
import signal
import os

OLLAMA_URL = "http://localhost:11434"
MODEL_NAME = "qwen2.5:14b"

_ollama_process = None

# ---------------------------------------------------------------------------
# Ollama lifecycle
# ---------------------------------------------------------------------------

def _is_ollama_running() -> bool:
    """Check if Ollama API is responsive."""
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        return r.status_code == 200
    except Exception:
        return False


def start_ollama():
    """Start Ollama serve as a child process if not already running."""
    global _ollama_process

    if _is_ollama_running():
        return True

    try:
        _ollama_process = subprocess.Popen(
            ["ollama", "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid if os.name != "nt" else None,
        )

        # Wait for it to be ready (up to 10 seconds)
        for _ in range(20):
            time.sleep(0.5)
            if _is_ollama_running():
                return True

        return False
    except FileNotFoundError:
        return False


def stop_ollama():
    """Stop the Ollama process we started."""
    global _ollama_process
    if _ollama_process is not None:
        try:
            os.killpg(os.getpgid(_ollama_process.pid), signal.SIGTERM)
        except (ProcessLookupError, OSError):
            pass
        _ollama_process = None


def ensure_model() -> bool:
    """Pull the model if not already available. Returns True if model is ready."""
    try:
        # Check if model exists
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if r.ok:
            models = [m["name"] for m in r.json().get("models", [])]
            # Check for exact match or match without tag
            if any(MODEL_NAME in m for m in models):
                return True

        # Pull the model
        print(f"Pulling model {MODEL_NAME}... (first time only, ~9GB download)")
        r = requests.post(
            f"{OLLAMA_URL}/api/pull",
            json={"name": MODEL_NAME, "stream": False},
            timeout=600,  # 10 min timeout for large downloads
        )
        return r.ok
    except Exception:
        return False


# Register cleanup
atexit.register(stop_ollama)

# ---------------------------------------------------------------------------
# LLM port extraction
# ---------------------------------------------------------------------------

EXTRACTION_PROMPT = """You are a strict port extraction tool. Given product specs, identify ONLY physical I/O ports that are EXPLICITLY mentioned in the text below.

CRITICAL RULES:
- ONLY return ports that are EXPLICITLY written in the specs. If a connector type is NOT mentioned in the specs, DO NOT include it.
- Do NOT guess, assume, or invent ports. If the specs only mention Ethernet ports, return ONLY Ethernet ports.
- Do NOT include: gain levels, impedance, frequency response, dimensions, weight, channel counts without connectors, software features, phantom power, faders, meters, EQ, effects, protocols, switching bandwidth, MAC table size, security features, PoE budgets.
- Include expansion slots and option card slots if explicitly listed.

CONNECTOR MAPPING (use these exact values):
- connector must be one of: xlr, trs, rca, hdmi, sdi, ethernet, dante, usb, speakon, powercon, dmx, fiber, aes50, ndi, wifi, thunderbolt, db9, bnc, displayport, sd
- 1/4 inch and 3.5mm and 1/8 inch jacks = "trs"
- etherCON and RJ45 = "ethernet"
- BNC for SDI = "sdi" (NOT "bnc")
- BNC for reference, genlock, blackburst, composite video, component video, word clock = "bnc" (NOT "sdi")
- USB-C (without explicit Thunderbolt mention) = "usb" with variant "usb-c"
- USB Type-A = "usb" with variant "usb-a"
- USB Type-B = "usb" with variant "usb-b"
- Thunderbolt 1/2/3/4, USB-C Thunderbolt = "thunderbolt"
- DE-9, DB-9, RS-422, RS-232 serial control = "db9"
- DisplayPort, Mini DisplayPort = "displayport"
- powerCON and IEC = "powercon"
- Expansion/option card slots = "ethernet" with domain "network"
- SD, SDHC, SDXC card slots = "sd" with variant "sd-full"
- microSD, microSDHC, microSDXC = "sd" with variant "sd-micro"
- CFast = "sd" with variant "sd-cfast"
- CFexpress = "sd" with variant "sd-cfexpress"

IMPORTANT for adapters and cables:
- Specs with "Connector 1", "Connector 2" etc. describe SEPARATE physical connectors. Each one is its own port with its own connector type.
- A USB-C to HDMI adapter has TWO ports: one USB (variant usb-c) and one HDMI — NOT two HDMI ports.
- Do NOT collapse different connector types into one type just because they carry the same signal.

VARIANT MAPPING (optional - include ONLY when the specs explicitly state the physical subtype):
- XLR: "xlr-3pin", "xlr-5pin", "xlr-7pin"
- TRS: "trs-quarter" (for 1/4 inch), "trs-3.5mm" (for 3.5mm/1/8 inch), "trs-2.5mm"
- HDMI: "hdmi-full", "hdmi-mini", "hdmi-micro"
- Ethernet: "ethernet-rj45", "ethernet-ethercon"
- USB: "usb-a", "usb-b", "usb-c", "usb-micro-b"
- Powercon: "powercon-20a", "powercon-32a", "powercon-true1"
- Speakon: "speakon-2pole", "speakon-4pole", "speakon-8pole"
- SDI: "sdi-bnc", "sdi-micro-bnc"
- Thunderbolt: "thunderbolt-3", "thunderbolt-4"
- DB9: "db9-rs422", "db9-rs232"
- BNC: "bnc-reference", "bnc-composite", "bnc-wordclock"
- DisplayPort: "displayport-full", "displayport-mini"
- SD: "sd-full" (for SD/SDHC/SDXC), "sd-micro" (for microSD/microSDHC/microSDXC), "sd-cfast", "sd-cfexpress"
- If the specs don't mention a specific subtype, OMIT the variant field entirely.

DOMAIN MAPPING (use these exact values):
- domain must be one of: audio, video, network, power, av-over-ip
- XLR, TRS, RCA, speakon = "audio"
- HDMI, SDI, BNC (reference/composite/component), DisplayPort = "video"
- NDI = "video"
- Ethernet, RJ45, etherCON, USB, Thunderbolt, DB9 (RS-422/RS-232), expansion slots, SD card readers = "network"
- powerCON, IEC = "power"
- Dante, AES50 = "av-over-ip"

DIRECTION: input, output, or bidirectional
- Ethernet, USB, Thunderbolt, SD card readers, expansion slots = "bidirectional"
- Power inputs = "input"
- If the port name/specs explicitly say "Input" (e.g. "HDMI Input"), use "input"
- If the port name/specs explicitly say "Output" (e.g. "SDI Output"), use "output"
- For HDMI, SDI, DisplayPort, BNC ports WITHOUT explicit "Input"/"Output" in the name:
  - Displays (TV, monitor, projector): video ports default to "input" (they receive signal)
  - Sources (camera, player, recorder): video ports default to "output" (they send signal)
  - Processors (switcher, matrix, router, scaler): video ports default to "bidirectional"
  - If device type is unclear, use "bidirectional"

REMEMBER: Every device has a power input. If specs mention power supply, wattage, or power draw, include a single power input port (connector "powercon", domain "power", direction "input").

Return a JSON object with a "ports" array. Only include ports you can directly point to in the specs text.
{"ports":[{"qty":4,"label":"HDMI Input","connector":"hdmi","variant":"hdmi-full","domain":"video","direction":"input"},{"qty":1,"label":"Ethernet","connector":"ethernet","variant":"ethernet-rj45","domain":"network","direction":"bidirectional"}]}

PRODUCT SPECS:
"""


def _filter_io_categories(specs: dict) -> dict:
    """
    Filter spec categories to only I/O-relevant ones.
    Prefers 'Connectivity' over 'Key Specs' to avoid duplicates.
    Drops categories like Signal Processing, Performance, Physical, etc.
    When multiple categories have overlapping keys, keeps the most comprehensive one.
    Filters individual entries within categories to remove noise.
    """
    io_keywords = [
        "connectivity", "input", "output", "i/o", "interface",
        "connection", "power", "expansion", "card reader",
    ]

    # Check if a dedicated Connectivity section exists
    has_connectivity = any("connectivity" in cat.lower() for cat in specs)

    # Skip categories that never contain ports
    skip_cats = ["signal processing", "performance", "digital audio",
                 "physical", "packaging", "compatibility", "recording"]

    # Keys that should be dropped from categories passed to the LLM
    noise_keys = re.compile(
        r'\b(?:dimension|weight|enclosure|material|compatibility|os\s|operating\s*system|'
        r'cable\s*length|lock\s*slot|wireless\s*charging)\b',
        re.IGNORECASE,
    )

    # Keys that indicate port information
    port_keys = ["input", "output", "i/o", "port", "connector",
                  "usb", "hdmi", "sdi", "ethernet", "expansion",
                  "card reader", "host connection", "thunderbolt", "displayport"]

    filtered: dict = {}
    for category, items in specs.items():
        cat_lower = category.lower()

        # Skip 'Key Specs' / 'Mixer' if we have a dedicated Connectivity section
        if has_connectivity and cat_lower in ("key specs", "mixer"):
            continue

        if any(s in cat_lower for s in skip_cats):
            continue

        # Determine if this category contains I/O info
        is_io_cat = any(kw in cat_lower for kw in io_keywords)
        has_port_keys = any(any(pk in k.lower() for pk in port_keys) for k in items)

        if is_io_cat or has_port_keys:
            # Filter out noise entries within the category
            clean_items = {
                k: v for k, v in items.items()
                if not noise_keys.search(k)
            }
            if clean_items:
                filtered[category] = clean_items

    if not filtered:
        return specs

    # Deduplicate: if "Key Specs" and "General Specs" both made it through
    # and share overlapping keys, keep only the more comprehensive one
    cats = list(filtered.keys())
    if len(cats) == 2:
        items_a = set(filtered[cats[0]].keys())
        items_b = set(filtered[cats[1]].keys())
        overlap = items_a & items_b
        if overlap and len(overlap) >= min(len(items_a), len(items_b)) * 0.5:
            # Keep whichever has more entries
            if len(items_b) >= len(items_a):
                del filtered[cats[0]]
            else:
                del filtered[cats[1]]

    return filtered


def _repair_json(text: str) -> str:
    """
    Attempt to fix common JSON errors from small LLMs,
    e.g. unescaped quotes inside string values like  "label":"1/4" TRS"
    """
    try:
        json.loads(text)
        return text  # already valid
    except json.JSONDecodeError:
        pass

    # Strategy: walk through and escape interior quotes in string values.
    # Replace " that appear mid-value (between a non-separator char and a non-separator char)
    # Pattern: a quote that is NOT preceded by { [ , : or backslash, and NOT followed by , } ] :
    repaired = re.sub(
        r'(?<=[a-zA-Z0-9/])\"(?=[a-zA-Z0-9 ])',
        'in.',
        text,
    )
    return repaired


# Map connector types to keywords that MUST appear in specs for the port to be valid
CONNECTOR_EVIDENCE = {
    "xlr": ["xlr"],
    "trs": ["trs", "1/4", "3.5mm", "1/8", "phone jack", "6.35mm", "6.3mm", "line in", "line out", "headphone"],
    "rca": ["rca", "phono"],
    "hdmi": ["hdmi"],
    "sdi": ["sdi", "bnc"],
    "ethernet": ["ethernet", "rj45", "rj-45", "ethercon", "gigabit", "10/100", "lan", "network port"],
    "dante": ["dante"],
    "usb": ["usb"],
    "speakon": ["speakon", "speak-on"],
    "powercon": ["powercon", "power-con", "iec", "ac input", "ac power", "power inlet", "power supply", "external power", "dc power", "power adapter", "dc barrel", "dc input", "power draw", "watt", " w "],
    "dmx": ["dmx"],
    "fiber": ["fiber", "fibre", "sfp", "optical"],
    "aes50": ["aes50", "aes/ebu", "aes3"],
    "ndi": ["ndi"],
    "wifi": ["wi-fi", "wifi", "wireless", "802.11", "wlan"],
    "thunderbolt": ["thunderbolt", "tb3", "tb4"],
    "db9": ["db-9", "de-9", "db9", "de9", "rs-422", "rs422", "rs-232", "rs232", "serial control", "machine control"],
    "bnc": ["bnc", "reference", "genlock", "blackburst", "tri-level", "word clock", "wordclock", "composite", "component"],
    "displayport": ["displayport", "display port", "dp 1.", "mini dp", "mini displayport"],
    "sd": ["sd", "sdhc", "sdxc", "microsd", "micro sd", "card reader", "memory card",
           "cfast", "cfexpress", "compactflash", "compact flash"],
}

# Valid variant values per connector type (for LLM output validation)
VALID_VARIANTS = {
    "xlr": {"xlr-3pin", "xlr-5pin", "xlr-7pin"},
    "trs": {"trs-quarter", "trs-3.5mm", "trs-2.5mm"},
    "hdmi": {"hdmi-full", "hdmi-mini", "hdmi-micro"},
    "ethernet": {"ethernet-rj45", "ethernet-ethercon"},
    "usb": {"usb-a", "usb-b", "usb-c", "usb-micro-b"},
    "powercon": {"powercon-20a", "powercon-32a", "powercon-true1"},
    "speakon": {"speakon-2pole", "speakon-4pole", "speakon-8pole"},
    "sdi": {"sdi-bnc", "sdi-micro-bnc"},
    "thunderbolt": {"thunderbolt-3", "thunderbolt-4"},
    "db9": {"db9-rs422", "db9-rs232"},
    "bnc": {"bnc-reference", "bnc-composite", "bnc-wordclock"},
    "displayport": {"displayport-full", "displayport-mini"},
    "sd": {"sd-full", "sd-micro", "sd-cfast", "sd-cfexpress"},
}

# Evidence keywords for variant detection
VARIANT_EVIDENCE = {
    "xlr-3pin": ["3-pin", "3 pin", "xlr-3"],
    "xlr-5pin": ["5-pin", "5 pin", "xlr-5", "dmx"],
    "xlr-7pin": ["7-pin", "7 pin", "xlr-7"],
    "trs-quarter": ["1/4", "6.35mm", "6.3mm", "quarter"],
    "trs-3.5mm": ["3.5mm", "1/8", "mini jack", "minijack"],
    "trs-2.5mm": ["2.5mm"],
    "hdmi-full": ["full-size hdmi", "standard hdmi", "type a hdmi", "hdmi type a"],
    "hdmi-mini": ["mini hdmi", "hdmi mini", "type c hdmi", "hdmi type c"],
    "hdmi-micro": ["micro hdmi", "hdmi micro", "type d hdmi", "hdmi type d"],
    "ethernet-rj45": ["rj45", "rj-45"],
    "ethernet-ethercon": ["ethercon", "ether-con"],
    "usb-a": ["usb-a", "usb type-a", "usb type a"],
    "usb-b": ["usb-b", "usb type-b", "usb type b"],
    "usb-c": ["usb-c", "usb type-c", "usb type c", "usb c"],
    "usb-micro-b": ["micro-usb", "micro usb", "micro-b"],
    "powercon-20a": ["powercon 20", "20a"],
    "powercon-32a": ["powercon 32", "32a"],
    "powercon-true1": ["true1"],
    "speakon-2pole": ["2-pole", "2 pole", "nl2"],
    "speakon-4pole": ["4-pole", "4 pole", "nl4"],
    "speakon-8pole": ["8-pole", "8 pole", "nl8"],
    "sdi-bnc": ["bnc"],
    "sdi-micro-bnc": ["micro-bnc", "micro bnc"],
    "thunderbolt-3": ["thunderbolt 3", "tb3"],
    "thunderbolt-4": ["thunderbolt 4", "tb4"],
    "db9-rs422": ["rs-422", "rs422"],
    "db9-rs232": ["rs-232", "rs232"],
    "bnc-reference": ["reference", "genlock", "blackburst", "tri-level"],
    "bnc-composite": ["composite"],
    "bnc-wordclock": ["word clock", "wordclock"],
    "displayport-full": ["displayport", "display port", "full-size displayport"],
    "displayport-mini": ["mini displayport", "mini dp", "mdp"],
    "sd-full": ["sdhc", "sdxc", "sd card", "full-size sd"],
    "sd-micro": ["microsdhc", "microsdxc", "microsd", "micro sd", "micro-sd"],
    "sd-cfast": ["cfast"],
    "sd-cfexpress": ["cfexpress"],
}


# ---------------------------------------------------------------------------
# Deterministic "Connector N" extraction for adapters/cables
# ---------------------------------------------------------------------------

# Ordered from most specific to least specific so "usb-c" matches before "usb"
CONNECTOR_TYPE_PATTERNS: list[tuple[str, dict]] = [
    ("usb type-c", {"connector": "usb", "variant": "usb-c", "domain": "network"}),
    ("usb type c", {"connector": "usb", "variant": "usb-c", "domain": "network"}),
    ("usb-c", {"connector": "usb", "variant": "usb-c", "domain": "network"}),
    ("usb type-a", {"connector": "usb", "variant": "usb-a", "domain": "network"}),
    ("usb type a", {"connector": "usb", "variant": "usb-a", "domain": "network"}),
    ("usb-a", {"connector": "usb", "variant": "usb-a", "domain": "network"}),
    ("usb type-b", {"connector": "usb", "variant": "usb-b", "domain": "network"}),
    ("usb type b", {"connector": "usb", "variant": "usb-b", "domain": "network"}),
    ("usb-b", {"connector": "usb", "variant": "usb-b", "domain": "network"}),
    ("micro-usb", {"connector": "usb", "variant": "usb-micro-b", "domain": "network"}),
    ("micro usb", {"connector": "usb", "variant": "usb-micro-b", "domain": "network"}),
    ("mini displayport", {"connector": "displayport", "variant": "displayport-mini", "domain": "video"}),
    ("mini dp", {"connector": "displayport", "variant": "displayport-mini", "domain": "video"}),
    ("displayport", {"connector": "displayport", "domain": "video"}),
    ("mini hdmi", {"connector": "hdmi", "variant": "hdmi-mini", "domain": "video"}),
    ("micro hdmi", {"connector": "hdmi", "variant": "hdmi-micro", "domain": "video"}),
    ("hdmi", {"connector": "hdmi", "domain": "video"}),
    ("thunderbolt", {"connector": "thunderbolt", "domain": "network"}),
    ("ethercon", {"connector": "ethernet", "variant": "ethernet-ethercon", "domain": "network"}),
    ("rj-45", {"connector": "ethernet", "variant": "ethernet-rj45", "domain": "network"}),
    ("rj45", {"connector": "ethernet", "variant": "ethernet-rj45", "domain": "network"}),
    ("ethernet", {"connector": "ethernet", "domain": "network"}),
    ("xlr", {"connector": "xlr", "domain": "audio"}),
    ("speakon", {"connector": "speakon", "domain": "audio"}),
    ("trs", {"connector": "trs", "domain": "audio"}),
    ("rca", {"connector": "rca", "domain": "audio"}),
    ("sdi", {"connector": "sdi", "domain": "video"}),
    ("bnc", {"connector": "bnc", "domain": "video"}),
    ("fiber", {"connector": "fiber", "domain": "network"}),
    ("optical", {"connector": "fiber", "domain": "network"}),
    # SD card readers (most specific first)
    ("microsdhc", {"connector": "sd", "variant": "sd-micro", "domain": "network"}),
    ("microsdxc", {"connector": "sd", "variant": "sd-micro", "domain": "network"}),
    ("microsd", {"connector": "sd", "variant": "sd-micro", "domain": "network"}),
    ("micro sd", {"connector": "sd", "variant": "sd-micro", "domain": "network"}),
    ("cfexpress", {"connector": "sd", "variant": "sd-cfexpress", "domain": "network"}),
    ("cfast", {"connector": "sd", "variant": "sd-cfast", "domain": "network"}),
    ("sdhc", {"connector": "sd", "variant": "sd-full", "domain": "network"}),
    ("sdxc", {"connector": "sd", "variant": "sd-full", "domain": "network"}),
    ("sd card", {"connector": "sd", "variant": "sd-full", "domain": "network"}),
    ("usb", {"connector": "usb", "domain": "network"}),  # generic USB last
]


def _infer_adapter_directions(ports: list[dict], product_name: str) -> list[dict]:
    """
    Infer port directions for adapters/cables based on "X to Y" pattern in product name.
    First connector type = input side, second = output side.
    Network-domain connectors (USB, Ethernet, Thunderbolt) stay bidirectional.
    """
    name_lower = product_name.lower()

    # Match patterns like "USB-C to HDMI", "USB Type-C to HDMI", "HDMI to DisplayPort", etc.
    to_match = re.search(
        r'(\b(?:usb(?:[-\s]?(?:type[-\s]?)?[abc])?|hdmi|sdi|displayport|display\s*port|thunderbolt|ethernet|xlr|trs|rca|speakon|bnc|fiber|optical|dante|aes50|dmx|vga)\b)'
        r'\s+to\s+'
        r'(\b(?:usb(?:[-\s]?(?:type[-\s]?)?[abc])?|hdmi|sdi|displayport|display\s*port|thunderbolt|ethernet|xlr|trs|rca|speakon|bnc|fiber|optical|dante|aes50|dmx|vga)\b)',
        name_lower,
    )

    if not to_match:
        # No "X to Y" pattern — default all to bidirectional
        for port in ports:
            port["direction"] = "bidirectional"
        return ports

    # Normalize matched connector names to our connector types
    def _normalize(s: str) -> str:
        s = re.sub(r'[-\s]+', '', s.lower())
        if s.startswith("usb"):
            return "usb"
        if s in ("displayport",):
            return "displayport"
        if s in ("optical",):
            return "fiber"
        return s

    input_type = _normalize(to_match.group(1))
    output_type = _normalize(to_match.group(2))

    network_connectors = {"usb", "ethernet", "thunderbolt"}

    # If same domain on both sides (e.g. "HDMI to HDMI"), all bidirectional (it's a cable)
    if input_type == output_type:
        for port in ports:
            port["direction"] = "bidirectional"
        return ports

    for port in ports:
        conn = port.get("connector", "")
        # Network-domain connectors always stay bidirectional
        if conn in network_connectors:
            port["direction"] = "bidirectional"
        elif conn == input_type:
            port["direction"] = "input"
        elif conn == output_type:
            port["direction"] = "output"
        else:
            port["direction"] = "bidirectional"

    return ports


def _extract_spec_connectors(specs: dict, product_name: str = "") -> list[dict]:
    """
    Deterministically extract ports from 'Connector N' spec entries.
    These appear on B&H for adapters, cables, and simple accessories.
    More reliable than LLM for these simple products.
    """
    connector_key_pattern = re.compile(r"^Connector\s*\d*$", re.IGNORECASE)
    qty_pattern = re.compile(r"^(\d+)\s*x\s+(.+)$", re.IGNORECASE)

    ports: list[dict] = []
    for _category, items in specs.items():
        for label, value in items.items():
            if not connector_key_pattern.match(label):
                continue

            # Parse "1x USB-C Male" or "1x HDMI Female"
            match = qty_pattern.match(value.strip())
            if match:
                qty = int(match.group(1))
                desc = match.group(2).strip()
            else:
                qty = 1
                desc = value.strip()

            desc_lower = desc.lower()

            # Clean gender from description for the label
            clean_label = re.sub(r"\s*(male|female)\s*", " ", desc, flags=re.IGNORECASE).strip()

            # Match against known connector types (most specific first)
            mapped = None
            for type_key, type_info in CONNECTOR_TYPE_PATTERNS:
                if type_key in desc_lower:
                    mapped = type_info
                    break

            if mapped:
                port: dict = {
                    "qty": qty,
                    "label": clean_label,
                    "connector": mapped["connector"],
                    "domain": mapped["domain"],
                    "direction": "bidirectional",  # placeholder — fixed below
                }
                if "variant" in mapped:
                    port["variant"] = mapped["variant"]
                ports.append(port)

    # Infer directions from product name "X to Y" pattern
    if ports:
        ports = _infer_adapter_directions(ports, product_name)

    return ports


# ---------------------------------------------------------------------------
# Deterministic "labeled I/O" extraction for hubs/adapters/complex devices
# ---------------------------------------------------------------------------

# Spec keys that indicate port/connector information
_IO_KEY_RE = re.compile(
    r'\b(?:i/?o|input|output|interface|connector|connection|host\s*connection|'
    r'media\s*card\s*reader|card\s*reader|card\s*slot|memory\s*card)\b',
    re.IGNORECASE,
)

# Spec keys to skip even if they look I/O-related
_NOISE_KEY_RE = re.compile(
    r'\b(?:dimension|weight|enclosure|material|compatibility|resolution|'
    r'wireless\s*charging|lock\s*slot|cable\s*length|os\b|operating\s*system|'
    r'max\s*resolution)\b',
    re.IGNORECASE,
)


def _extract_labeled_io_ports(specs: dict, product_name: str = "") -> list[dict]:
    """
    Deterministically extract ports from B&H labeled I/O spec entries.
    Handles formats like:
      "USB I/O": "1x USB-C (Charging Only) | 2x USB-A 3.2 Gen 2"
      "Video I/O": "1x HDMI"
      "Network I/O": "1x RJ45 (10/100/1000 Mb/s)"
      "Media Card Reader": "1x SDHC (UHS-I) | 1x microSDHC"
      "Host Connection": "USB-C 3.2 Gen 2..."
    Returns a list of port dicts, or empty list if no labeled I/O found.
    """
    qty_pattern = re.compile(r"^(\d+)\s*x\s+(.+)$", re.IGNORECASE)
    ports: list[dict] = []
    seen_entries: set[str] = set()  # dedup across overlapping categories

    for _category, items in specs.items():
        for key, value in items.items():
            # Only process I/O-relevant keys
            if not _IO_KEY_RE.search(key):
                continue
            # Skip noise
            if _NOISE_KEY_RE.search(key):
                continue
            # Skip empty/no values
            val_stripped = value.strip()
            if val_stripped.lower() in ("no", "none", "n/a", ""):
                continue
            # Deduplicate across categories (Key Specs + General Specs often overlap)
            dedup = f"{key}|{value}"
            if dedup in seen_entries:
                continue
            seen_entries.add(dedup)

            key_lower = key.lower()
            is_host = "host" in key_lower
            has_input = "input" in key_lower
            has_output = "output" in key_lower

            # Split value into individual port entries on " | " and ", "
            raw_parts = [
                p.strip()
                for segment in value.split(" | ")
                for p in segment.split(", ")
                if p.strip() and p.strip().lower() not in ("no", "none", "n/a", "/")
            ]

            for raw in raw_parts:
                # Parse "Nx Description"
                m = qty_pattern.match(raw)
                if m:
                    qty = int(m.group(1))
                    desc = m.group(2).strip()
                else:
                    qty = 1
                    desc = raw.strip()

                if not desc or len(desc) < 2:
                    continue

                desc_lower = desc.lower()

                # Map to connector type using CONNECTOR_TYPE_PATTERNS
                mapped = None
                for type_key, type_info in CONNECTOR_TYPE_PATTERNS:
                    if type_key in desc_lower:
                        mapped = type_info
                        break

                # Fall back to key name for mapping (e.g. "Network I/O" → ethernet)
                if not mapped:
                    for type_key, type_info in CONNECTOR_TYPE_PATTERNS:
                        if type_key in key_lower:
                            mapped = type_info
                            break

                if not mapped:
                    continue  # Can't identify connector — skip

                # Build clean label from description
                clean_label = re.sub(
                    r"\s*(male|female)\s*", " ", desc, flags=re.IGNORECASE
                ).strip()
                # Trim parenthetical details for cleaner label
                paren_match = re.match(r"^([^(]+?)(?:\s*\(.+\).*)?$", clean_label)
                if paren_match:
                    short = paren_match.group(1).strip()
                    if len(short) >= 3:
                        clean_label = short
                # Cap overly long labels (e.g. host connection with specs in the value)
                if len(clean_label) > 30:
                    # Keep just the connector part (e.g. "USB-C 3.1/3.2 Gen 2" → "USB-C")
                    for type_key, _ in CONNECTOR_TYPE_PATTERNS:
                        if type_key in clean_label.lower():
                            clean_label = clean_label[:clean_label.lower().index(type_key) + len(type_key)]
                            break
                # Prefix host connection labels
                if is_host:
                    clean_label = f"Host {clean_label}"

                # Determine direction
                if is_host:
                    direction = "input"  # host cable = signal comes into adapter
                elif has_input and not has_output:
                    direction = "input"
                elif has_output and not has_input:
                    direction = "output"
                elif mapped["connector"] in ("ethernet", "usb", "thunderbolt", "sd"):
                    direction = "bidirectional"
                elif mapped.get("domain") == "video":
                    direction = "output"  # adapters/hubs typically output video
                else:
                    direction = "bidirectional"

                port: dict = {
                    "qty": qty,
                    "label": clean_label,
                    "connector": mapped["connector"],
                    "domain": mapped["domain"],
                    "direction": direction,
                }
                if "variant" in mapped:
                    port["variant"] = mapped["variant"]

                # Try to detect variant from description if not already set
                if "variant" not in port:
                    connector = mapped["connector"]
                    for var_name, var_keywords in VARIANT_EVIDENCE.items():
                        if var_name.startswith(connector + "-"):
                            if any(kw in desc_lower for kw in var_keywords):
                                port["variant"] = var_name
                                break

                ports.append(port)

    return ports


def _detect_device_type(product_name: str) -> str:
    """
    Classify a product into a device type category for direction inference.
    Returns: "display", "source", "processor", or "unknown".
    """
    n = product_name.lower()

    display_keywords = ["tv", "television", "monitor", "display", "projector", "screen", "panel",
                        "videowall", "video wall"]
    source_keywords = ["camera", "camcorder", "player", "recorder", "deck", "playback",
                       "blu-ray", "bluray", "dvd", "media server"]
    processor_keywords = ["switcher", "matrix", "router", "scaler", "converter",
                          "extender", "splitter", "distribution"]

    if any(kw in n for kw in display_keywords):
        return "display"
    if any(kw in n for kw in source_keywords):
        return "source"
    if any(kw in n for kw in processor_keywords):
        return "processor"
    return "unknown"


def _fix_port_directions(ports: list[dict], product_name: str = "") -> list[dict]:
    """
    Post-process port directions to fix common LLM errors.
    Ensures label-based direction consistency and uses device-type
    awareness for video connectors without explicit Input/Output labels.
    """
    video_connectors = {"hdmi", "sdi", "displayport", "bnc"}
    network_connectors = {"ethernet", "usb", "thunderbolt", "sd"}
    device_type = _detect_device_type(product_name)

    # Map device type to default video port direction
    video_default = {
        "display": "input",
        "source": "output",
        "processor": "bidirectional",
        "unknown": "undefined",
    }.get(device_type, "undefined")

    for port in ports:
        label_lower = port.get("label", "").lower()
        connector = port.get("connector", "")

        has_input = "input" in label_lower
        has_output = "output" in label_lower

        if has_input and not has_output:
            port["direction"] = "input"
        elif has_output and not has_input:
            port["direction"] = "output"
        elif connector in network_connectors:
            port["direction"] = "bidirectional"
        elif connector == "powercon":
            port["direction"] = "input"
        elif connector in video_connectors and not has_input and not has_output:
            # Use device-type-aware default instead of always bidirectional
            port["direction"] = video_default

    return ports


def _validate_ports_against_specs(ports: list[dict], specs_text: str) -> list[dict]:
    """
    Filter out hallucinated ports by checking if the connector type
    has supporting evidence in the original spec text.
    """
    specs_lower = specs_text.lower()
    validated = []
    for port in ports:
        connector = port.get("connector", "")
        evidence_keywords = CONNECTOR_EVIDENCE.get(connector, [])
        # If we have no evidence mapping, keep the port (unknown connector)
        if not evidence_keywords:
            validated.append(port)
            continue
        # Check if ANY evidence keyword appears in the specs
        if any(kw in specs_lower for kw in evidence_keywords):
            validated.append(port)
        # else: hallucinated port, drop it
    return validated


def extract_ports_with_llm(specs: dict, product_name: str = "") -> list[dict] | None:
    """
    Extract ports from product specs. Uses deterministic parsing for
    adapter/cable products (with "Connector N" entries), falling back
    to LLM for complex products.
    Returns a list of port dicts, or None if extraction fails.
    """
    # Try deterministic extraction first (reliable for adapters/cables)
    det_ports = _extract_spec_connectors(specs, product_name=product_name)
    if det_ports:
        return det_ports

    # Try labeled I/O extraction (reliable for hubs and complex adapters)
    labeled_ports = _extract_labeled_io_ports(specs, product_name=product_name)
    if labeled_ports:
        return labeled_ports

    # No deterministic matches — use LLM for complex products
    # Start Ollama if needed
    if not start_ollama():
        return None

    # Ensure model is available
    if not ensure_model():
        return None

    # Filter to I/O-relevant categories to reduce noise and avoid duplicates
    io_categories = _filter_io_categories(specs)

    # Format specs as readable text, sanitizing quotes to avoid JSON breakage
    specs_text = ""
    if product_name:
        specs_text += f"\nPRODUCT NAME: {product_name}\n"
    for category, items in io_categories.items():
        specs_text += f"\n[{category}]\n"
        for label, value in items.items():
            # Replace inch marks (") that confuse JSON output
            clean_val = value.replace('"', 'in.').replace('\u201c', '').replace('\u201d', '')
            specs_text += f"  {label}: {clean_val}\n"

    prompt = EXTRACTION_PROMPT + specs_text

    try:
        r = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "format": "json",
                "stream": False,
                "keep_alive": "5m",
                "options": {
                    "temperature": 0,
                    "num_predict": 2048,
                },
            },
            timeout=120,
        )

        if not r.ok:
            return None

        response_text = r.json().get("response", "").strip()

        # Repair common JSON issues from small models:
        # unescaped quotes inside string values like 1/4" TRS
        response_text = _repair_json(response_text)

        parsed = json.loads(response_text)

        # Handle both {"ports": [...]} and direct [...] formats
        if isinstance(parsed, dict):
            ports = parsed.get("ports", [])
        elif isinstance(parsed, list):
            ports = parsed
        else:
            return None

        # Validate structure
        valid_connectors = {
            "xlr", "trs", "rca", "hdmi", "sdi", "ethernet", "dante",
            "usb", "speakon", "powercon", "dmx", "fiber", "aes50", "ndi", "wifi",
            "thunderbolt", "db9", "bnc", "displayport", "sd",
        }
        valid_domains = {"audio", "video", "network", "power", "av-over-ip"}
        valid_directions = {"input", "output", "bidirectional", "undefined"}

        validated: list[dict] = []
        for p in ports:
            if not isinstance(p, dict):
                continue
            connector = str(p.get("connector", "")).lower()
            domain = str(p.get("domain", "")).lower()
            direction = str(p.get("direction", "")).lower()

            # Clamp to valid values
            if connector not in valid_connectors:
                connector = "ethernet"
            if domain not in valid_domains:
                domain = "network"
            if direction not in valid_directions:
                direction = "undefined"

            port_dict = {
                "qty": max(1, int(p.get("qty", 1))),
                "label": str(p.get("label", "Unknown Port")),
                "connector": connector,
                "domain": domain,
                "direction": direction,
            }

            # Validate and include variant if LLM provided one
            variant = str(p.get("variant", "")).lower() if p.get("variant") else None
            if variant:
                allowed = VALID_VARIANTS.get(connector, set())
                if variant in allowed:
                    port_dict["variant"] = variant

            validated.append(port_dict)

        # Cross-reference against original specs to filter hallucinated ports
        # Build full raw specs text for evidence checking
        raw_specs_text = ""
        for category, items in specs.items():
            raw_specs_text += f" {category} "
            for label, value in items.items():
                raw_specs_text += f" {label} {value} "

        validated = _validate_ports_against_specs(validated, raw_specs_text)
        validated = _fix_port_directions(validated, product_name=product_name)

        return validated if validated else None

    except (json.JSONDecodeError, requests.RequestException, ValueError):
        return None
