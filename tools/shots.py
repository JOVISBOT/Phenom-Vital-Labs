"""Capture the screens a visitor actually sees, so they can be looked at.

Usage: python tools/shots.py <base_url> <outdir> [--dark]
Drives the calculator to a real result before shooting it -- an empty form is
not the screen anyone spends time on.
"""
import sys, os, pathlib
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/")
OUT = pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
DARK = "--dark" in sys.argv

VIEWS = [("desktop", 1280, 900), ("phone", 390, 844)]


def shoot(page, name, view, full=True):
    p = OUT / f"{name}-{view}.png"
    page.screenshot(path=str(p), full_page=full)
    print(p)


with sync_playwright() as pw:
    b = pw.chromium.launch()
    for view, w, h in VIEWS:
        ctx = b.new_context(viewport={"width": w, "height": h},
                            device_scale_factor=2)
        pg = ctx.new_page()
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))

        # calculator, empty
        pg.goto(BASE + "/", wait_until="networkidle")
        if DARK:
            pg.evaluate("document.documentElement.setAttribute('data-theme','dark')")
            pg.wait_for_timeout(200)
        shoot(pg, "calc-empty", view)

        # calculator, driven to a result
        pg.select_option("#peptide", "blend_gh1")
        pg.wait_for_timeout(150)
        pg.click("#calculateBtn")
        pg.wait_for_timeout(500)
        shoot(pg, "calc-result", view)

        for path, name in [("/p/", "directory"), ("/p/blend_gh1/", "reference"),
                           ("/plan/", "planner")]:
            pg.goto(BASE + path, wait_until="networkidle")
            if DARK:
                pg.evaluate("document.documentElement.setAttribute('data-theme','dark')")
                pg.wait_for_timeout(200)
            shoot(pg, name, view)

        print(f"[{view}] console errors: {errs if errs else 'none'}")
        ctx.close()
    b.close()
