# yadax.im

Personal portfolio — a single static page, no build step. Hosted on GitHub Pages with the custom domain in `CNAME`.

- `index.html`, `style.css` — the page
- `fake-terminal.js`, `vfs.js` — the terminal easter egg (from `~/Coding/js-terminal`)
- `cv.pdf` — generated; don't edit. Rebuilt from `~/life/projects/active/job-search/cv-research.html` (phone number stripped, needs `chromium-browser`):
  `python3 build-cv.py`

Preview locally: `python3 -m http.server` → http://localhost:8000
