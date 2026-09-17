# yadax.im

Personal portfolio — a single static page, no build step. Hosted on GitHub Pages with the custom domain in `CNAME`.

- `index.html`, `style.css` — the page
- `fake-terminal.js`, `vfs.js` — the terminal easter egg (from `~/Coding/js-terminal`)
- `cv.pdf` — generated; don't edit. Rebuild from the master CV (phone number stripped):
  `~/Coding/TAOADHD/venv/bin/python build-cv.py`

Preview locally: `python3 -m http.server` → http://localhost:8000
