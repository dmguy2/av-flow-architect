"""
FastAPI server for B&H Photo Video product scraping.
Single endpoint: POST /api/scrape
"""

import io
import json
import os
import zipfile
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
import atexit
import requests as http_requests

# Load .env file if present
_env_file = Path(__file__).parent / '.env'
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, val = line.split('=', 1)
            os.environ.setdefault(key.strip(), val.strip())

THREEDAI_API_KEY = os.environ.get('THREEDAI_API_KEY')

from scraper import (
    get_driver,
    shutdown_driver,
    get_bh_data,
    download_images_base64,
    extract_schematic_data,
)
from llm_ports import extract_ports_with_llm, stop_ollama, start_ollama, ensure_model, OLLAMA_URL, MODEL_NAME

app = FastAPI(title="AV Flow Architect – B&H Scraper")


class ScrapeRequest(BaseModel):
    url: str


class ScrapeResponse(BaseModel):
    name: str
    images: list[str]  # base64 data URIs
    specs: dict
    ports: list[dict]  # structured port data (from LLM or regex fallback)
    port_source: str   # "llm" or "regex" — so frontend knows quality
    dimensions: dict | None = None  # {width_inches, height_inches, depth_inches} for 3D scaling


@app.post("/api/scrape", response_model=ScrapeResponse)
def scrape_product(req: ScrapeRequest):
    """
    Scrape a B&H product page and return product data with base64 images.
    Ports are extracted by LLM when available, with regex fallback.
    """
    url = req.url.strip()
    if "bhphotovideo.com/c/product/" not in url:
        raise HTTPException(status_code=400, detail="URL must be a B&H product page")

    try:
        driver = get_driver()
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to launch Chrome browser: {e}",
        )

    try:
        # Scrape the product page
        raw = get_bh_data(driver, url)

        if "error" in raw:
            raise HTTPException(status_code=502, detail=raw["error"])

        # Re-acquire driver in case get_bh_data invalidated it (page load timeout)
        try:
            driver = get_driver()
        except Exception:
            pass  # best-effort — images will fail gracefully below

        # Download images as base64
        images_b64 = download_images_base64(driver, raw.get("images", []))

        specs = raw.get("specs", {})

        # Try LLM-based extraction first
        product_name = raw.get("name", "Unknown Product")
        llm_ports = extract_ports_with_llm(specs, product_name=product_name)

        # Extract physical dimensions for 3D scaling
        dimensions = _extract_dimensions(specs, product_name)
        if dimensions:
            print(f"[DIMS] {product_name}: {dimensions}")

        if llm_ports is not None:
            return ScrapeResponse(
                name=product_name,
                images=images_b64,
                specs=specs,
                ports=llm_ports,
                port_source="llm",
                dimensions=dimensions,
            )

        # Fallback: regex-based extraction
        schematic = extract_schematic_data(specs)
        regex_ports = _flatten_regex_ports(schematic.get("ports", {}))

        return ScrapeResponse(
            name=product_name,
            images=images_b64,
            specs=specs,
            ports=regex_ports,
            port_source="regex",
            dimensions=dimensions,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


def _extract_dimensions(specs: dict, product_name: str) -> dict | None:
    """Extract physical dimensions from product specs using Gemini."""
    from llm_ports import GEMINI_API_KEY, _call_gemini
    if not GEMINI_API_KEY:
        return None

    # Collect dimension-related spec entries
    dim_text = f"Product: {product_name}\n"
    found_dims = False
    for category, items in specs.items():
        for key, val in items.items():
            kl = key.lower()
            if any(w in kl for w in ['dimension', 'width', 'height', 'depth', 'length', 'size', 'weight', 'display size']):
                dim_text += f"{key}: {val}\n"
                found_dims = True

    if not found_dims:
        return None

    prompt = f"""Extract the physical dimensions of this product in INCHES.
If dimensions are in cm or mm, convert to inches (1 inch = 2.54 cm).
Width = horizontal/left-right. Height = vertical/top-bottom. Depth = front-to-back.
For displays/TVs, the screen diagonal is NOT the width — use actual body dimensions if available, or estimate from screen size (a 55" TV is roughly 48.5" wide x 28" tall x 2.5" deep).
For a laptop with a screen size like 14", estimate: ~12.3" wide x 8.7" tall x 0.6" deep.

Return ONLY a JSON object: {{"width_inches": N, "height_inches": N, "depth_inches": N}}

Specs:
{dim_text}"""

    try:
        result = _call_gemini(prompt)
        if result:
            dims = json.loads(result)
            w = float(dims.get('width_inches', 0))
            h = float(dims.get('height_inches', 0))
            d = float(dims.get('depth_inches', 0))
            if w > 0 and h > 0 and d > 0:
                return {'width_inches': round(w, 1), 'height_inches': round(h, 1), 'depth_inches': round(d, 1)}
    except Exception as e:
        print(f"Dimension extraction failed: {e}")

    return None


def _flatten_regex_ports(nested_ports: dict) -> list[dict]:
    """Flatten the nested regex port structure into the same flat format as LLM output."""
    result = []
    for _category, specs in nested_ports.items():
        for _spec_name, port_nodes in specs.items():
            for node in port_nodes:
                result.append({
                    "qty": node.get("qty", 1),
                    "label": node.get("port_description", "Unknown"),
                    "connector": "ethernet",
                    "domain": "network",
                    "direction": "bidirectional",
                })
    return result


class ChainNode(BaseModel):
    label: str
    componentType: str
    manufacturer: str | None = None
    model: str | None = None
    inConnector: str | None = None
    inVariant: str | None = None
    outConnector: str | None = None
    outVariant: str | None = None
    powerDraw: str | None = None


class AnalyzeChainRequest(BaseModel):
    chain: list[ChainNode]
    context: str  # "audio" or "video"


class ChainIssueResult(BaseModel):
    severity: str  # error | warning | info
    category: str
    message: str
    suggestion: str


class AnalyzeChainResponse(BaseModel):
    issues: list[ChainIssueResult]
    summary: str


CHAIN_ANALYSIS_PROMPT = """You are an experienced AV systems engineer analyzing a signal chain.
Given this signal path from source to destination, identify any potential issues.

Focus on these categories:
1. GAIN STAGING: Is a mic-level signal reaching a line-level input without a preamp? Is there proper gain structure?
2. IMPEDANCE: Is a hi-Z source (guitar) going into a low-Z input without a DI box?
3. POWER: Are passive speakers connected without an amplifier in the chain?
4. MISSING DEVICE: Is a critical device missing (preamp, DI box, converter, scaler)?
5. SIGNAL TYPE: Are there analog-to-digital conversion issues? Missing converters?

Signal chain (in order from source to destination):
{chain_text}

Context: This is a {context} signal chain.

Return a JSON object with this exact format:
{{"issues": [{{"severity": "error|warning|info", "category": "gain-staging|impedance|power|missing-device|signal-type", "message": "description of the issue", "suggestion": "how to fix it"}}], "summary": "brief one-sentence assessment"}}
If the chain looks correct, return {{"issues": [], "summary": "Signal chain looks good"}}
"""


@app.post("/api/analyze-chain", response_model=AnalyzeChainResponse)
def analyze_chain(req: AnalyzeChainRequest):
    """Send a signal chain to the local LLM for intelligent analysis."""
    if not start_ollama():
        raise HTTPException(status_code=503, detail="Ollama is not available")

    if not ensure_model():
        raise HTTPException(status_code=503, detail="LLM model is not available")

    # Format the chain as readable text
    chain_lines = []
    for i, node in enumerate(req.chain):
        parts = [f"{i + 1}. {node.label}"]
        if node.manufacturer and node.model:
            parts.append(f"({node.manufacturer} {node.model})")
        elif node.componentType:
            parts.append(f"[{node.componentType}]")
        if node.inConnector:
            variant_str = f" ({node.inVariant})" if node.inVariant else ""
            parts.append(f"← {node.inConnector.upper()}{variant_str}")
        if node.outConnector:
            variant_str = f" ({node.outVariant})" if node.outVariant else ""
            parts.append(f"→ {node.outConnector.upper()}{variant_str}")
        if node.powerDraw:
            parts.append(f"[{node.powerDraw}]")
        chain_lines.append(" ".join(parts))

    chain_text = "\n".join(chain_lines)
    prompt = CHAIN_ANALYSIS_PROMPT.format(chain_text=chain_text, context=req.context)

    try:
        r = http_requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "format": "json",
                "stream": False,
                "keep_alive": "5m",
                "options": {
                    "temperature": 0,
                    "num_predict": 1024,
                },
            },
            timeout=60,
        )

        if not r.ok:
            raise HTTPException(status_code=502, detail="LLM request failed")

        response_text = r.json().get("response", "").strip()
        parsed = json.loads(response_text)

        issues = []
        for issue in parsed.get("issues", []):
            issues.append(ChainIssueResult(
                severity=str(issue.get("severity", "info")),
                category=str(issue.get("category", "signal-type")),
                message=str(issue.get("message", "")),
                suggestion=str(issue.get("suggestion", "")),
            ))

        return AnalyzeChainResponse(
            issues=issues,
            summary=parsed.get("summary", "Analysis complete"),
        )

    except json.JSONDecodeError:
        return AnalyzeChainResponse(
            issues=[],
            summary="LLM returned invalid response — try again",
        )
    except http_requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"LLM connection error: {e}")


@app.post("/api/driver/shutdown")
def driver_shutdown():
    """Explicitly shut down the Chrome driver. Called by frontend after a batch import finishes."""
    shutdown_driver()
    return {"status": "ok"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# 3D AI Studio proxy endpoints
# ---------------------------------------------------------------------------

THREEDAI_BASE = "https://api.3daistudio.com"


@app.get("/api/3d/available")
def check_3d_available():
    """Check if 3D AI Studio API is configured."""
    return {"available": bool(THREEDAI_API_KEY)}


ALLOWED_DOWNLOAD_DOMAINS = [
    "3daistudio.com",
    "amazonaws.com",
    "cloudfront.net",
    "r2.cloudflarestorage.com",
]


class Generate3DRequest(BaseModel):
    image: str  # base64 data URI (e.g. "data:image/png;base64,XXXX")
    component_type: str
    prompt: str | None = None


def _threedai_headers() -> dict:
    if not THREEDAI_API_KEY:
        raise HTTPException(status_code=503, detail="THREEDAI_API_KEY is not configured")
    return {"Authorization": f"Bearer {THREEDAI_API_KEY}"}


@app.post("/api/3d/generate")
def generate_3d_model(req: Generate3DRequest):
    """Submit an image for 3D model generation via 3D AI Studio."""
    headers = _threedai_headers()
    print(f"[3D] Submitting generation for {req.component_type} (Prompt: {req.prompt})")

    # Send the full data URI — the API expects data:image/...;base64,... format
    image_data = req.image

    payload = {
        "model": "3.5",
        "image": image_data,
        "enable_pbr": True,
    }
    if req.prompt:
        payload["prompt"] = req.prompt

    try:
        r = http_requests.post(
            f"{THREEDAI_BASE}/v1/3d-models/tencent/generate/rapid/",
            headers=headers,
            json=payload,
            timeout=30,
        )
    except http_requests.RequestException as e:
        print(f"[3D] Connection error: {e}")
        raise HTTPException(status_code=502, detail=f"3D AI Studio connection error: {e}")

    if r.status_code == 429:
        print(f"[3D] Rate limit exceeded (429)")
        raise HTTPException(status_code=429, detail="Rate limit exceeded — try again later")
    if r.status_code == 402:
        print(f"[3D] Insufficient credits (402)")
        raise HTTPException(status_code=402, detail="Insufficient 3D AI Studio credits")
    if not r.ok:
        detail = r.text[:300] if r.text else f"3D generation failed ({r.status_code})"
        print(f"[3D] Error response: {detail}")
        raise HTTPException(status_code=r.status_code, detail=detail)

    data = r.json()
    task_id = data.get("id") or data.get("task_id") or data.get("request_id")
    print(f"[3D] Submission successful: task_id={task_id}")
    return {"task_id": task_id}


@app.get("/api/3d/status/{task_id}")
def get_3d_status(task_id: str):
    """Poll the generation status for a 3D model task."""
    headers = _threedai_headers()

    try:
        r = http_requests.get(
            f"{THREEDAI_BASE}/v1/generation-request/{task_id}/status/",
            headers=headers,
            timeout=30,
        )
    except http_requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"3D AI Studio connection error: {e}")

    if r.status_code == 429:
        raise HTTPException(status_code=429, detail="Rate limit exceeded — try again later")
    if not r.ok:
        raise HTTPException(status_code=r.status_code, detail=f"Status check failed ({r.status_code})")

    data = r.json()
    status = data.get("status", "UNKNOWN")
    model_url = None

    if status == "FINISHED":
        # Extract model download URL — actual API returns results[].asset
        results = data.get("results", [])
        if results and isinstance(results, list):
            model_url = results[0].get("asset")
        if not model_url:
            # Fallback to other possible response shapes
            model_url = (
                data.get("output", {}).get("model", None)
                or data.get("model_url")
                or data.get("result", {}).get("model_url", None)
                or data.get("result", {}).get("model", None)
            )
        if not model_url:
            # Asset URL may not be ready yet — report as still in progress
            status = "IN_PROGRESS"

    return {"status": status, "model_url": model_url}


@app.get("/api/3d/download")
def download_3d_model(url: str = Query(..., description="Model file URL to download")):
    """Proxy model file download. Extracts OBJ from ZIP if the response is a ZIP archive."""
    # SSRF protection: validate the URL domain
    parsed = urlparse(url)
    if not parsed.scheme == "https":
        raise HTTPException(status_code=400, detail="Only HTTPS URLs are allowed")

    hostname = parsed.hostname or ""
    if not any(hostname.endswith(domain) for domain in ALLOWED_DOWNLOAD_DOMAINS):
        raise HTTPException(
            status_code=400,
            detail=f"URL domain not allowed: {hostname}",
        )

    try:
        r = http_requests.get(url, timeout=60)
    except http_requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Download failed: {e}")

    if not r.ok:
        raise HTTPException(status_code=r.status_code, detail=f"Upstream returned {r.status_code}")

    # If the response is a ZIP, extract the OBJ file
    content = r.content
    content_type = r.headers.get("Content-Type", "application/octet-stream")
    try:
        zip_bytes = io.BytesIO(content)
        if zipfile.is_zipfile(zip_bytes):
            zip_bytes.seek(0)
            with zipfile.ZipFile(zip_bytes) as zf:
                obj_name = next((n for n in zf.namelist() if n.endswith(".obj")), None)
                if obj_name:
                    content = zf.read(obj_name)
                    content_type = "model/obj"
    except Exception:
        pass  # Not a valid ZIP — return raw content

    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": "attachment"},
    )


@app.get("/api/3d/balance")
def get_3d_balance():
    """Check remaining 3D AI Studio credits."""
    headers = _threedai_headers()

    try:
        r = http_requests.get(
            f"{THREEDAI_BASE}/account/user/wallet/",
            headers=headers,
            timeout=30,
        )
    except http_requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"3D AI Studio connection error: {e}")

    if not r.ok:
        raise HTTPException(status_code=r.status_code, detail=f"Balance check failed ({r.status_code})")

    data = r.json()
    credits = data.get("credits") or data.get("balance") or 0
    return {"credits": credits}


# Clean up Chrome + Ollama on shutdown
atexit.register(shutdown_driver)
atexit.register(stop_ollama)
