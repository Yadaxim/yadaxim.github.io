#!/usr/bin/env python3
"""Build cv.pdf for the site from the master CV, without the phone number.

The site CV lives in ~/life/projects/active/job-search/cv-research.html.
Re-run after editing it:  python3 build-cv.py   (needs chromium-browser on PATH)
"""

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

SOURCE = Path.home() / "life/projects/active/job-search/cv-research.html"
OUT = Path(__file__).resolve().parent / "cv.pdf"

html = SOURCE.read_text(encoding="utf-8")
html, n = re.subn(r"\s*·\s*\+\d[\d ]{6,}\d", "", html)
if n == 0 and re.search(r"\+\d{3}", html):
    raise SystemExit("Phone number format changed — refusing to publish a CV that may contain it.")

chromium = shutil.which("chromium-browser") or shutil.which("chromium") or shutil.which("google-chrome")
if not chromium:
    raise SystemExit("No Chromium found on PATH.")

with tempfile.TemporaryDirectory() as tmp:
    page = Path(tmp) / "cv.html"
    page.write_text(html, encoding="utf-8")
    subprocess.run([chromium, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={OUT}", page.as_uri()],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

print(f"Wrote {OUT} (phone numbers removed: {n})")
