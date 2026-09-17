#!/usr/bin/env python3
"""Build cv.pdf for the site from the master CV, without the phone number.

The master CV lives in ~/life/projects/active/job-search/cv.html (generated from cv.md there).
Re-run after editing it:  ~/Coding/TAOADHD/venv/bin/python build-cv.py
"""

import re
from pathlib import Path

from playwright.sync_api import sync_playwright

SOURCE = Path.home() / "life/projects/active/job-search/cv.html"
OUT = Path(__file__).resolve().parent / "cv.pdf"

html = SOURCE.read_text(encoding="utf-8")
html, n = re.subn(r"\s*·\s*\+\d[\d ]{6,}\d", "", html)
if n == 0 and re.search(r"\+\d{3}", html):
    raise SystemExit("Phone number format changed — refusing to publish a CV that may contain it.")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.set_content(html, wait_until="load")
    page.pdf(path=str(OUT), format="A4", margin={"top": "15mm", "bottom": "15mm", "left": "12mm", "right": "12mm"},
             print_background=True)
    browser.close()

print(f"Wrote {OUT} (phone numbers removed: {n})")
