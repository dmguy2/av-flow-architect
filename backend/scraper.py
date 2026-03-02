"""
B&H Photo Video scraper — adapted from webscrapetest/scrape_bh.py.
Provides a persistent Chrome driver singleton and base64 image encoding
for integration with the FastAPI server.
"""

import undetected_chromedriver as uc
from bs4 import BeautifulSoup
import time
import re
import base64
import requests
import threading
import os
import signal

# ---------------------------------------------------------------------------
# Persistent Chrome driver singleton
# ---------------------------------------------------------------------------
_driver = None
_driver_lock = threading.Lock()


def get_driver():
    """Return a shared Chrome driver instance, launching one if needed."""
    global _driver
    with _driver_lock:
        if _driver is None:
            options = uc.ChromeOptions()
            _driver = uc.Chrome(options=options, version_main=145)
        return _driver


def shutdown_driver():
    """Quit the Chrome driver and kill any lingering Chrome processes it spawned."""
    global _driver
    with _driver_lock:
        if _driver is not None:
            # Grab the browser PID before quit() so we can force-kill stragglers
            browser_pid = None
            try:
                browser_pid = _driver.browser_pid
            except Exception:
                pass

            try:
                _driver.quit()
            except Exception:
                pass

            # uc.Chrome.quit() often leaves zombie Chrome processes on macOS —
            # kill the browser process group to be sure
            if browser_pid:
                try:
                    os.killpg(os.getpgid(browser_pid), signal.SIGTERM)
                except (ProcessLookupError, OSError, PermissionError):
                    pass

            _driver = None


# ---------------------------------------------------------------------------
# Image downloading — returns base64-encoded strings instead of saving files
# ---------------------------------------------------------------------------

def download_images_base64(driver, image_urls: list[str], max_images: int = 4) -> list[str]:
    """Download product images and return them as base64-encoded data URIs."""
    session = requests.Session()
    user_agent = driver.execute_script("return navigator.userAgent;")
    session.headers.update({
        "User-Agent": user_agent,
        "Referer": "https://www.bhphotovideo.com/",
    })

    for cookie in driver.get_cookies():
        session.cookies.set(cookie["name"], cookie["value"])

    results: list[str] = []
    for url in image_urls[:max_images]:
        try:
            response = session.get(url, timeout=15)
            response.raise_for_status()

            # Determine MIME type from URL extension
            ext = url.split(".")[-1].split("?")[0].lower()
            mime = {
                "png": "image/png",
                "webp": "image/webp",
                "gif": "image/gif",
            }.get(ext, "image/jpeg")

            b64 = base64.b64encode(response.content).decode("ascii")
            results.append(f"data:{mime};base64,{b64}")
        except Exception:
            pass  # skip failed downloads

    return results


# ---------------------------------------------------------------------------
# Core scraping — fetches product page + specs tab
# ---------------------------------------------------------------------------

def _extract_product_images(soup: BeautifulSoup, images: list[str], max_images: int = 4) -> None:
    """Extract B&H product image URLs from a parsed page into the images list."""
    for img in soup.find_all("img"):
        if len(images) >= max_images:
            break
        src = img.get("src", "")
        if "bhphotovideo.com/images/" in src and (
            "images500x500" in src
            or "images1000x1000" in src
            or "images2500x2500" in src
        ):
            if "/cdn-cgi/image/" in src:
                try:
                    src = "https://" + src.split("https://")[1]
                except Exception:
                    pass
            if src not in images:
                images.append(src)


def get_bh_data(driver, url: str) -> dict:
    """
    Scrape a B&H product page for images and specifications.
    Returns {"name": str, "images": [...urls], "specs": {category: {label: value}}}.
    """
    base_url = url.replace("/specs", "").rstrip("/")

    images: list[str] = []
    specs_dict: dict[str, dict[str, str]] = {}
    product_name = ""

    try:
        # --- 1. Fetch images from main product page ---
        driver.get(base_url)
        time.sleep(5)

        soup = BeautifulSoup(driver.page_source, "html.parser")

        # Detect Cloudflare / bot protection page and wait for it to clear
        page_text = soup.get_text().lower()
        if "just a moment" in page_text or "checking your browser" in page_text:
            time.sleep(12)
            soup = BeautifulSoup(driver.page_source, "html.parser")

        # Extract product name from page title (multiple fallbacks)
        title_tag = soup.find("h1", attrs={"data-selenium": "productTitle"})
        if title_tag:
            product_name = title_tag.get_text(strip=True)
        else:
            # Try <title> tag (usually "Product Name | B&H Photo")
            title_el = soup.find("title")
            if title_el:
                raw = title_el.get_text(strip=True)
                clean = raw.split("|")[0].split(" - B&H")[0].strip()
                if clean and "_" not in clean and len(clean) > 3:
                    product_name = clean
            # Try og:title meta tag
            if not product_name:
                og = soup.find("meta", attrs={"property": "og:title"})
                if og and og.get("content"):
                    product_name = og["content"].strip()

        _extract_product_images(soup, images)

        # Try og:image if no product images found on main page
        if not images:
            og_img = soup.find("meta", attrs={"property": "og:image"})
            if og_img and og_img.get("content"):
                images.append(og_img["content"])

        # --- 2. Fetch specs from /specs tab ---
        specs_url = base_url + "/specs"
        driver.get(specs_url)
        time.sleep(5)

        soup = BeautifulSoup(driver.page_source, "html.parser")

        # If main page failed to get name/images, try from specs page
        if not product_name or "_" in product_name:
            specs_h1 = soup.find("h1")
            if specs_h1:
                text = specs_h1.get_text(strip=True)
                # Specs page h1 is usually "Product Name Specs"
                if text.lower().endswith(" specs"):
                    text = text[:-6].strip()
                if text and "_" not in text and len(text) > 3:
                    product_name = text

        if not images:
            _extract_product_images(soup, images)

        # Reject bot-protection page names
        _captcha_names = ["just a moment", "access denied", "checking your browser", "attention required"]
        if product_name and any(cn in product_name.lower() for cn in _captcha_names):
            product_name = ""

        # Final URL slug fallback for product name
        if not product_name or "_" in product_name:
            slug = base_url.split("/")[-1].replace(".html", "")
            product_name = slug.replace("-", " ").replace("_", " ").title()

        spec_tables = soup.find_all("table", attrs={"data-selenium": "specsItemGroupTable"})

        if not spec_tables:
            # Possible CAPTCHA — wait and retry
            time.sleep(15)
            soup = BeautifulSoup(driver.page_source, "html.parser")
            spec_tables = soup.find_all("table", attrs={"data-selenium": "specsItemGroupTable"})
            if not spec_tables:
                return {"name": product_name, "images": images, "specs": {}}

        for table in spec_tables:
            parent_div = table.parent
            group_tag = parent_div.find(attrs={"data-selenium": "specsItemGroupName"})
            category_name = group_tag.get_text(strip=True) if group_tag else "General Specs"

            if category_name not in specs_dict:
                specs_dict[category_name] = {}

            rows = table.find_all("tr", attrs={"data-selenium": "specsItemGroupTableRow"})
            for row in rows:
                label_td = row.find(
                    attrs={"data-selenium": "specsItemGroupTableLabel"}
                ) or row.find(attrs={"data-selenium": "specsItemGroupTableColumnLabel"})
                value_td = row.find(
                    attrs={"data-selenium": "specsItemGroupTableValue"}
                ) or row.find(attrs={"data-selenium": "specsItemGroupTableColumnValue"})

                if label_td and value_td:
                    label = label_td.get_text(strip=True)
                    value = value_td.get_text(separator=" | ", strip=True)
                    specs_dict[category_name][label] = value

        return {"name": product_name, "images": images, "specs": specs_dict}
    except Exception as e:
        return {"name": product_name, "images": images, "specs": {}, "error": str(e)}


# ---------------------------------------------------------------------------
# Port parsing — unchanged from original
# ---------------------------------------------------------------------------

def parse_ports_to_schematic_nodes(value_string: str) -> list[dict]:
    """
    Parse strings like "1x HDMI Output | 2 x BNC (12G-SDI)" into structured objects.
    """
    nodes: list[dict] = []
    raw_ports = [
        p.strip()
        for part in value_string.split(" | ")
        for p in part.split(", ")
        if p.strip()
    ]

    port_pattern = re.compile(r"^(\d+)\s*x\s*(.+)$", re.IGNORECASE)

    for port in raw_ports:
        match = port_pattern.match(port)
        if match:
            qty = int(match.group(1))
            description = match.group(2).strip()
            nodes.append({"qty": qty, "port_description": description})
        else:
            if port.lower() not in ("no", "none", "n/a"):
                nodes.append({"qty": 1, "port_description": port})

    return nodes


def extract_schematic_data(product_specs: dict) -> dict:
    """Extract I/O information from product specs for schematic use."""
    io_keywords = [
        "input", "output", "interface", "connection", "connectivity",
        "usb", "hdmi", "sdi", "port", "connector", "network",
        "audio i/o", "video i/o", "power", "control",
        "rs-232", "rs-422", "gpio", "tally", "dmx", "ethernet", "lan", "ccu",
    ]

    schematic_data: dict = {
        "is_passive_device": True,
        "ports": {},
    }

    for category, specs in product_specs.items():
        cat_lower = category.lower()
        is_io_category = any(
            kw in cat_lower
            for kw in ["input", "output", "interface", "connection", "connectivity", "power"]
        )

        for spec_name, spec_val in specs.items():
            spec_lower = spec_name.lower()
            keyword_match = any(
                re.search(rf"\b{re.escape(kw)}\b", spec_lower) for kw in io_keywords
            )

            if is_io_category or keyword_match:
                if "dimension" in spec_lower or "weight" in spec_lower:
                    continue

                schematic_data["is_passive_device"] = False
                structured_nodes = parse_ports_to_schematic_nodes(spec_val)
                if structured_nodes:
                    if category not in schematic_data["ports"]:
                        schematic_data["ports"][category] = {}
                    schematic_data["ports"][category][spec_name] = structured_nodes

    return schematic_data
