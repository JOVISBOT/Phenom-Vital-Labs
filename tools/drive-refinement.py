"""Drive the pieces added in the 2026-08-20 UI pass, in a real browser.

The unit tests read source files; this reads the rendered page. Both were needed
for every bug this pass fixed - the dark-theme ghost button was invisible to a
source grep and obvious in a screenshot.

Usage:  python tools/drive-refinement.py [base_url] [out_dir]
"""
import sys, json, pathlib
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765").rstrip("/")
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "shots-refine")
OUT.mkdir(exist_ok=True)

errors, report = [], {}


def watch(page, tag):
    page.on("console", lambda m: errors.append(f"{tag}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"{tag}: pageerror {e}"))
    page.on("requestfailed", lambda r: errors.append(f"{tag}: requestfailed {r.url}"))


def calc(page, pid="blend_gh1"):
    page.select_option("#peptide", pid)
    page.click("#calculateBtn")
    page.wait_for_selector(".dose-grid", timeout=8000)
    # The Generate scroll is smooth and asynchronous. Scrolling on top of it
    # races the browser and the page slides back under you - which is how a
    # working dock measured as height 0 the first time it was probed.
    page.wait_for_timeout(1600)


def overflow(page):
    return page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")


with sync_playwright() as pw:
    browser = pw.chromium.launch()

    # ---- the answer bar -------------------------------------------------
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    watch(page, "dock")
    page.goto(BASE + "/", wait_until="networkidle")
    dock = {"before_calc_hidden": page.evaluate("document.getElementById('answerDock').hidden")}

    calc(page)
    dock["at_hero_hidden"] = page.evaluate("document.getElementById('answerDock').hidden")
    dock["page_height"] = page.evaluate("document.documentElement.scrollHeight")

    page.evaluate("window.scrollTo(0, 2400)")
    page.wait_for_timeout(700)
    dock["scrolled_hidden"] = page.evaluate("document.getElementById('answerDock').hidden")
    dock["height"] = round(page.evaluate("document.getElementById('answerDock').getBoundingClientRect().height"), 1)
    dock["units"] = page.inner_text("#dockUnits")
    dock["dose"] = page.inner_text("#dockDose")
    dock["name"] = page.inner_text("#dockName")
    page.screenshot(path=str(OUT / "dock-desktop.png"))

    # the jump has to clear the fixed bar, not land under it
    page.click(".answer-dock-top")
    page.wait_for_timeout(1200)
    dock["hero_top_after_jump"] = round(page.evaluate(
        "document.getElementById('answer').getBoundingClientRect().top"), 1)
    dock["hidden_after_jump"] = page.evaluate("document.getElementById('answerDock').hidden")
    dock["query_survived_hash"] = "p=blend_gh1" in page.url and page.url.endswith("#answer")

    # a pre-filled pen has no draw, so the bar must stand down
    page.select_option("#peptide", "dulaglutide")
    page.wait_for_timeout(1800)
    page.evaluate("window.scrollTo(0, 2400)")
    page.wait_for_timeout(700)
    dock["no_draw_record_hidden"] = page.evaluate("document.getElementById('answerDock').hidden")
    report["dock"] = dock

    # ---- weight and age, folded but live --------------------------------
    page.goto(BASE + "/", wait_until="networkidle")
    opt = {"summary": page.inner_text("#optionalValues"),
           "open_by_default": page.evaluate("document.getElementById('optionalFields').open")}
    page.evaluate("document.getElementById('optionalFields').open = true")
    page.select_option("#weight", label="220 lbs")
    page.wait_for_timeout(400)
    opt["summary_after_change"] = page.inner_text("#optionalValues")
    calc(page)
    # the value has to reach the protocol note, not just the summary
    opt["reached_the_sheet"] = "220 lbs" in page.inner_text(".scaling-note")
    report["optional_fields"] = opt

    # ---- clearing the result puts the page back ------------------------
    page.select_option("#peptide", "")
    page.wait_for_timeout(600)
    report["cleared"] = {
        "results_empty": page.evaluate("!document.getElementById('results').innerHTML.trim()"),
        "dock_hidden": page.evaluate("document.getElementById('answerDock').hidden"),
        "teasers_back": page.is_visible(".directory-teaser"),
    }
    page.close()

    # ---- the directory filter ------------------------------------------
    hub = browser.new_page(viewport={"width": 1440, "height": 900})
    watch(hub, "hub")
    hub.goto(BASE + "/p/", wait_until="networkidle")
    total = hub.evaluate("document.querySelectorAll('main.container tbody tr').length")
    shown = lambda: hub.evaluate("[...document.querySelectorAll('main.container tbody tr')].filter(t=>!t.hidden).length")
    sections = lambda: hub.evaluate("[...document.querySelectorAll('main.container section.card')].filter(s=>!s.hidden).length")

    f = {"rows": total, "all_shown": shown(), "all_sections": sections(),
         "height_unfiltered": hub.evaluate("document.documentElement.scrollHeight")}
    hub.fill("#hubFilter", "bpc"); hub.wait_for_timeout(300)
    f["bpc"] = shown(); f["bpc_sections"] = sections()
    f["bpc_count_text"] = hub.inner_text(".hub-filter-count")
    f["height_filtered"] = hub.evaluate("document.documentElement.scrollHeight")
    # two words narrow rather than widen
    hub.fill("#hubFilter", "blend weekly"); hub.wait_for_timeout(300)
    f["blend_weekly"] = shown()
    hub.fill("#hubFilter", "zzzz"); hub.wait_for_timeout(300)
    f["no_match"] = shown()
    f["empty_message"] = hub.is_visible(".hub-filter-empty")
    hub.click(".hub-filter-clear"); hub.wait_for_timeout(300)
    f["after_clear"] = shown()
    hub.fill("#hubFilter", "tb"); hub.wait_for_timeout(200)
    hub.press("#hubFilter", "Escape"); hub.wait_for_timeout(300)
    f["after_escape"] = shown()
    f["overflow"] = overflow(hub)
    hub.screenshot(path=str(OUT / "hub-filter.png"))
    report["hub_filter"] = f
    hub.close()

    # ---- the planner, both themes --------------------------------------
    for theme in ("light", "dark"):
        pl = browser.new_page(viewport={"width": 1440, "height": 900})
        watch(pl, f"plan-{theme}")
        pl.goto(BASE + "/plan/", wait_until="networkidle")
        if theme == "dark":
            pl.evaluate("document.documentElement.setAttribute('data-theme','dark')")
            pl.wait_for_timeout(300)
        # the row that used to leave two tall blanks
        groups = pl.eval_on_selector_all("legend", "e => e.map(x => x.textContent.trim())")
        bare = pl.eval_on_selector_all(
            "label[for]", "e => e.filter(x => !x.querySelector('.label-icon')).map(x => x.getAttribute('for'))")
        btn = lambda sel: pl.eval_on_selector(
            sel, "e => {const c = getComputedStyle(e); return c.backgroundImage === 'none' ? c.backgroundColor : 'gradient'}")
        pl.select_option("#peptide", "blend_gh1")
        pl.wait_for_timeout(300)
        # Picking a record flips the dose unit to whatever that record is stated
        # in. Typing a bare number without reading it back is the same u-vs-ml
        # slip the calculator's original bug was made of - 167 mg instead of
        # 167 mcg is a thousandfold, and the page correctly refuses it.
        unit = pl.inner_text("#doseUnit").strip()
        pl.fill("#doseAmount", "0.167" if unit == "mg" else "167")
        pl.fill("#mixDate", "2026-08-06"); pl.fill("#mlLeft", "0.9")
        pl.click("#planBtn")
        pl.wait_for_selector(".plan-card", timeout=8000)
        pl.wait_for_timeout(700)
        report[f"plan_{theme}"] = {
            "groups": groups,
            "labels_without_icon": bare,
            "plan_btn": btn("#planBtn"), "save_btn": btn("#saveBtn"), "clear_btn": btn("#clearBtn"),
            "overflow": overflow(pl),
            "dose_unit": unit,
            "vial_card": " ".join(pl.inner_text(".plan-card").split())[:170],
        }
        pl.screenshot(path=str(OUT / f"plan-{theme}.png"), full_page=True)
        pl.close()

    # ---- phone ----------------------------------------------------------
    m = browser.new_page(viewport={"width": 390, "height": 844})
    watch(m, "mobile")
    m.goto(BASE + "/", wait_until="networkidle")
    calc(m)
    m.evaluate("window.scrollTo(0, 3000)")
    m.wait_for_timeout(700)
    report["mobile"] = {
        "dock_height": round(m.evaluate("document.getElementById('answerDock').getBoundingClientRect().height"), 1),
        "overflow": overflow(m),
        "page_height": m.evaluate("document.documentElement.scrollHeight"),
    }
    m.screenshot(path=str(OUT / "dock-mobile.png"))
    m.close()

    browser.close()

report["console_errors"] = errors
print(json.dumps(report, indent=2))
print("\nconsole/network errors:", len(errors))
(OUT / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
