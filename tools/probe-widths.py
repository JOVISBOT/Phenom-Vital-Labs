"""Walk every page across the widths a phone actually is, and fail on layout.

Two defects shipped past a green suite, a zero-console-error browser drive and
the calculator's own mobileOverflowX check: the form overlapped its own labels
below 500px, and the directory pushed the document 25px wider than the viewport
on every phone. Nothing measured the pages that were broken.

Usage:  python tools/probe-widths.py [base_url]
Exits 1 if any page overflows horizontally or any two form labels overlap.
"""
import sys, json
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765").rstrip("/")
PAGES = [("/", "calculator"), ("/plan/", "planner"), ("/p/", "directory"),
         ("/p/blend_gh1/", "reference page")]
WIDTHS = [320, 360, 390, 414, 500, 501, 560, 700, 768, 900, 1280]

PROBE = """() => {
  const de = document.documentElement;
  const labels = [...document.querySelectorAll('.form-grid label')].map(e => e.getBoundingClientRect());
  let overlap = null;
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i], b = labels[j];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlap = [i, j];
    }
  const wide = [];
  for (const e of document.querySelectorAll('main *')) {
    if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible')
      wide.push(e.tagName + '.' + (e.className || '').toString().split(' ')[0]);
  }
  return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, overlap, wide: wide.slice(0, 4) };
}"""

fails = []
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for path, name in PAGES:
        for w in WIDTHS:
            page = browser.new_page(viewport={"width": w, "height": 900})
            page.goto(BASE + path, wait_until="networkidle")
            page.wait_for_timeout(300)
            r = page.evaluate(PROBE)
            page.close()
            if r["scrollWidth"] > r["clientWidth"]:
                fails.append(f'{name} @{w}px scrolls sideways: {r["scrollWidth"]}px of content '
                             f'in a {r["clientWidth"]}px viewport. Widest: {r["wide"]}')
            if r["overlap"]:
                fails.append(f'{name} @{w}px prints two form labels through each other {r["overlap"]}')
    browser.close()

print(json.dumps({"pages": len(PAGES), "widths": len(WIDTHS),
                  "checks": len(PAGES) * len(WIDTHS), "failures": fails}, indent=1))
if fails:
    sys.exit(1)
print(f"clean across {len(PAGES) * len(WIDTHS)} page/width combinations")
