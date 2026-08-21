"""Shoot individual components at 1:1 so they can be judged, not squinted at.

A full-page screenshot of an 8,000px result page is downscaled ~4x before
anyone looks at it, which is exactly the scale at which four distinct icons
look like four identical blue squares. Component shots are the fix.

Usage: python tools/shot-parts.py <base_url> <outdir>
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/")
OUT = pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
# A component shot that only ever runs in light mode misses the class of defect
# these shots exist for -- the icon chip that forgot to invert was invisible in
# light and unreadable in dark.
DARK = "--dark" in sys.argv

# Selector guessed from memory rather than read off the page is how three of
# these silently printed MISS while the run still exited 0 -- the form, the dose
# ladder and the directory were never shot, and nothing said so louder than one
# line of stdout. Every selector below is verified against the real markup, and
# a MISS is now a failure, because a component shot tool that skips components
# is worse than none: it reports coverage it does not have.
PARTS = [
    ("/", "header", "header"),
    ("/", "form", ".form-grid", False),
    ("/", "hero", ".answer-hero", True),
    ("/", "tiers", ".dose-grid", True),
    ("/", "syringe", ".syringe-guide, .syringe-visual", True),
    ("/", "infogrid", ".info-grid", True),
    ("/", "proscons", ".pros-cons-grid", True),
    ("/p/", "hub", ".data-table--compact", False),
    ("/p/blend_gh1/", "reference", ".card.answer-card", False),
]

missed = []

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=2)
    pg = ctx.new_page()
    if DARK:
        # Set before the first navigation so the pre-paint boot script reads it,
        # rather than toggling after load and shooting a half-repainted page.
        # The key is 'pvl-theme' (js/theme.js STORAGE_KEY) -- a plain 'theme'
        # writes a key nothing reads, and the run then files light-mode shots
        # into a folder named dark, which is worse than not running it.
        pg.add_init_script("localStorage.setItem('pvl-theme','dark')")
    for path, name, sel, *rest in PARTS:
        needs_result = bool(rest and rest[0])
        pg.goto(BASE + path, wait_until="networkidle")
        if DARK:
            actual = pg.evaluate("document.documentElement.getAttribute('data-theme')")
            assert actual == "dark", f"--dark asked for, page rendered {actual!r}"
        if needs_result:
            pg.select_option("#peptide", "blend_gh1")
            pg.wait_for_timeout(150)
            pg.click("#calculateBtn")
            pg.wait_for_timeout(600)
        # Wait for the element rather than for a fixed 600ms. The first version
        # slept and then asked once, so .info-grid -- which is appended late and
        # carries an entry animation -- shot fine on one run and printed MISS on
        # the next. A flaky probe is read as a flaky page.
        try:
            pg.wait_for_selector(sel, timeout=5000, state="attached")
        except Exception:
            pass
        el = pg.query_selector(sel)
        if not el:
            missed.append(f"{name}: {sel} (on {path})")
            print(f"MISS {name}: {sel}")
            continue
        p = OUT / f"{name}.png"
        el.screenshot(path=str(p))
        print(p)
    b.close()

if missed:
    print()
    print(f"{len(missed)} component(s) never shot:")
    for m in missed:
        print(f"  {m}")
    sys.exit(1)
print()
print(f"{len(PARTS)} components shot at 1:1")
