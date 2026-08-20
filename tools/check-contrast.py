"""Measure text contrast on the real rendered page, in both themes.

Dark mode shipped with a <select> whose text was buried under a tiled chevron
and breadcrumb separators at 1.2:1 -- neither is visible to a DOM test and both
are obvious in a screenshot. This walks every element that owns a text node,
resolves the colour it actually paints on, and reports WCAG AA failures.

Elements painted by a gradient are skipped rather than guessed at: their
computed backgroundColor is transparent, which would otherwise resolve to the
page background and report a false 1.0:1 on every button.

Usage:  python tools/check-contrast.py [base_url]
Exit:   non-zero if any element fails AA.
"""
import sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765").rstrip("/")

JS = r"""
() => {
  const lum = c => { const s = c.map(v => { v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126*s[0] + 0.7152*s[1] + 0.0722*s[2]; };
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].split(',').map(Number);
    return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  const flatten = (fg, bg) => fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

  // Nearest ancestor that paints an opaque colour. Returns null when a gradient
  // is in the way -- unmeasurable from computed style, so not guessed at.
  const bgOf = el => { let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0.95) return c.rgb;
      n = n.parentElement;
    }
    return [255, 255, 255]; };

  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const txt = [...el.childNodes].filter(n => n.nodeType === 3)
      .map(n => n.textContent.trim()).join(' ').trim();
    if (!txt) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.1) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const fg = parse(cs.color); if (!fg) continue;
    const bg = bgOf(el); if (!bg) continue;
    const cr = ratio(flatten(fg, bg), bg);
    const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
    const need = (px >= 24 || (px >= 18.66 && bold)) ? 3 : 4.5;
    if (cr < need) out.push({
      sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
      text: txt.slice(0, 40), ratio: +cr.toFixed(2), need, px: +px.toFixed(1)
    });
  }
  return out;
}
"""

TARGETS = [("app", "/?p=nadplus"), ("app-blend", "/?p=blend_gh1"),
           ("page", "/p/nadplus/"), ("hub", "/p/")]

failures = 0
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for theme in ("light", "dark"):
        for label, path in TARGETS:
            ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            page = ctx.new_page()
            page.add_init_script(
                "try{localStorage.setItem('pvl-theme','%s')}catch(e){}" % theme)
            page.goto(BASE + path, wait_until="networkidle")
            page.wait_for_timeout(900)
            rows, seen = [], set()
            for r in page.evaluate(JS):
                key = (r["sel"], r["ratio"])
                if key in seen:
                    continue
                seen.add(key)
                rows.append(r)
            failures += len(rows)
            print(f"{theme:<5} {label:<10} {len(rows)} failing")
            for r in sorted(rows, key=lambda x: x["ratio"]):
                print(f"    {r['ratio']:>5}:1 (needs {r['need']}) {r['sel'][:50]:<50} {r['text']!r}")
            ctx.close()
    browser.close()

print("\nCONTRAST:", "clean" if not failures else f"{failures} failing")
sys.exit(1 if failures else 0)
