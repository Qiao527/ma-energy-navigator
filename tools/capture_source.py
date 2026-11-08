"""Save an official page or PDF as a text snapshot for the rule-drafting workflow (docs/product.md §6a, step 1).

Usage: python3 tools/capture_source.py SLUG URL
Writes rules/ma/sources/SLUG.txt and SLUG.meta.json {url, fetchedOn, sha256}.

Uses headless Chromium (mass.gov blocks plain HTTP clients). HTML: the full page text including collapsed
tabs. PDF: text extracted with pypdf. Needs: pip install playwright pypdf; python3 -m playwright install chromium.
Set CHROMIUM_PATH to use an existing headless Chromium binary.
"""
import datetime
import hashlib
import html
import io
import json
import os
import re
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "rules" / "ma" / "sources"


def html_to_text(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", "", raw)
    text = html.unescape(re.sub(r"<[^>]+>", "\n", raw))
    return "\n".join(line.strip() for line in text.split("\n") if line.strip())


def pdf_to_text(data: bytes) -> str:
    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(data))
    return "\n".join(f"[[page {i + 1}]]\n" + (page.extract_text() or "") for i, page in enumerate(reader.pages))


TEXT_SUFFIXES = (".tsv", ".txt", ".md", ".csv")


def fetch(url: str) -> str:
    if url.lower().endswith(TEXT_SUFFIXES):  # plain data files (e.g. on S3): no browser needed
        import urllib.request
        with urllib.request.urlopen(url, timeout=60) as resp:
            return resp.read().decode("utf-8")
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        kwargs = {"headless": True}
        if os.environ.get("CHROMIUM_PATH"):
            kwargs["executable_path"] = os.environ["CHROMIUM_PATH"]
        browser = p.chromium.launch(**kwargs)
        ctx = browser.new_context(accept_downloads=True)
        page = ctx.new_page()
        try:
            try:
                with page.expect_download(timeout=8000) as dl:
                    try:
                        page.goto(url, timeout=60000)
                    except Exception as e:  # a PDF link starts a download instead of a page
                        if "Download is starting" not in str(e):
                            raise
                return pdf_to_text(Path(dl.value.path()).read_bytes())
            except Exception as e:
                if "Timeout" not in type(e).__name__ and "Timeout" not in str(e):
                    raise
            resp = page.context.request.get(url) if url.lower().endswith(".pdf") else None
            if resp is not None and "pdf" in (resp.headers.get("content-type") or ""):
                return pdf_to_text(resp.body())
            page.wait_for_timeout(1500)
            return html_to_text(page.content())
        finally:
            browser.close()


def main(slug: str, url: str) -> None:
    if not re.fullmatch(r"[a-z0-9_-]+", slug):
        raise SystemExit("slug must be lowercase letters, digits, - or _")
    text = fetch(url)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{slug}.txt").write_text(text, encoding="utf-8")
    meta = {"url": url, "fetchedOn": datetime.date.today().isoformat(), "sha256": hashlib.sha256(text.encode()).hexdigest()}
    (OUT / f"{slug}.meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"saved {slug}: {len(text)} chars from {url}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
