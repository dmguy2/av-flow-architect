"""
FastAPI server for B&H Photo Video product scraping.
Single endpoint: POST /api/scrape
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import atexit

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

        # Download images as base64
        images_b64 = download_images_base64(driver, raw.get("images", []))

        specs = raw.get("specs", {})

        # Try LLM-based extraction first
        product_name = raw.get("name", "Unknown Product")
        llm_ports = extract_ports_with_llm(specs, product_name=product_name)

        if llm_ports is not None:
            return ScrapeResponse(
                name=product_name,
                images=images_b64,
                specs=specs,
                ports=llm_ports,
                port_source="llm",
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
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


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
    import requests as http_requests
    import json

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


# Clean up Chrome + Ollama on shutdown
atexit.register(shutdown_driver)
atexit.register(stop_ollama)
