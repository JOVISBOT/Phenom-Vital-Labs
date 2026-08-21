"""Measure every icon glyph against the chip it is painted on.

The icons stroke with `currentColor`. An inverted chip -- a dark gradient tile
with a glyph inside -- is therefore two declarations, not one, and the second
one is easy to forget. `.info-card-icon` forgot it: the glyph inherited
`--text` and painted #1F2937 on a #1E3D9D gradient at **1.50:1**, so the four
tiles on every result read as four identical dark squares. Its two siblings,
`.label-icon` and `.summary-icon`, both set `color:#fff`.

The text-contrast probe cannot see this -- an SVG owns no text node -- and a
full-page screenshot is downscaled about 4x before anyone looks at it, which is
exactly the scale at which four different icons look the same. So it is
measured here instead: every `.icon`, in both themes, on all three page types.

Gradients are read from the computed `background-image`, which already has its
custom properties substituted, and checked against EVERY stop -- a glyph that
clears one end of a gradient and fails the other is still unreadable at one
end.

Usage:  python tools/probe-icon-contrast.py [base_url]
Exit:   non-zero if any glyph falls below 3:1 on its own chip.
"""
import sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765").rstrip("/")

# 3:1 is the WCAG floor for a graphical object. These are aria-hidden and every
# one sits beside its own text label, so this is a legibility bar, not a
# conformance one -- but a glyph nobody can make out is a defect either way.
MIN = 3.0

JS = r"""() => {
  const rgb = s => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(v => parseFloat(v));
    if (p.length > 3 && p[3] === 0) return null;   // transparent paints nothing
    return p.slice(0, 3);
  };
  const lum = ([r, g, b]) => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
    return (hi + 0.05) / (lo + 0.05);
  };

  // Every colour the glyph could be sitting on: the nearest ancestor that
  // paints anything, taking every stop of a gradient rather than the first.
  const backdrops = el => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const img = cs.backgroundImage || '';
      if (img.includes('gradient')) {
        const stops = [...img.matchAll(/rgba?\([^)]+\)/g)].map(m => rgb(m[0])).filter(Boolean);
        if (stops.length) return { stops, on: n.className.toString().split(' ')[0] };
      }
      const bg = rgb(cs.backgroundColor);
      if (bg) return { stops: [bg], on: n.className.toString().split(' ')[0] };
    }
    return null;
  };

  const out = [];
  for (const svg of document.querySelectorAll('svg.icon')) {
    if (!svg.getClientRects().length) continue;            // not on screen
    const fg = rgb(getComputedStyle(svg).color);
    const back = backdrops(svg);
    if (!fg || !back) continue;
    const worst = Math.min(...back.stops.map(s => ratio(fg, s)));
    out.push({ on: back.on, chip: (svg.parentElement.className || '').toString().split(' ')[0],
               ratio: Math.round(worst * 100) / 100 });
  }
  return out;
}"""

PAGES = [("/", "calculator", True), ("/plan/", "planner", False),
         ("/p/", "directory", False), ("/p/blend_gh1/", "reference", False)]

fails, checked = [], 0
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for theme in ("light", "dark"):
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        for path, name, drive in PAGES:
            pg.goto(BASE + path, wait_until="networkidle")
            pg.evaluate(f"document.documentElement.setAttribute('data-theme','{theme}')")
            if drive:
                pg.select_option("#peptide", "blend_gh1")
                pg.wait_for_timeout(150)
                pg.click("#calculateBtn")
                pg.wait_for_timeout(600)
            pg.wait_for_timeout(150)
            for row in pg.evaluate(JS):
                checked += 1
                if row["ratio"] < MIN:
                    fails.append(f"{theme:5} {name:10} .{row['chip']} on .{row['on']}: {row['ratio']}:1")
        ctx.close()
    b.close()

seen = sorted(set(fails))
print(f"{checked} glyphs measured across 8 page/theme combinations")
for f in seen:
    print("  FAIL", f)
if seen:
    sys.exit(1)
print(f"clean - every glyph clears {MIN}:1 on its own chip")
