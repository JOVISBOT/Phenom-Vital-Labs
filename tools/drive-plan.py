"""Drive the mix & cycle planner in Chromium and report what actually renders.

Usage:  python tools/drive-plan.py [base_url] [out_dir]
"""
import sys, json, pathlib
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/").rstrip("/") + "/"
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "shots-plan")
OUT.mkdir(exist_ok=True)

errors, failed, report = [], [], {}


def scrape(page):
    return page.evaluate("""() => {
        const t = s => (document.querySelector(s)||{}).textContent?.trim() || '';
        return {
            cards: [...document.querySelectorAll('.plan-card')].map(c => ({
                title: c.querySelector('h2').textContent.trim(),
                lede: (c.querySelector('.answer-lede')||{}).textContent?.replace(/\\s+/g,' ').trim() || '',
                working: (c.querySelector('.working code')||{}).textContent?.replace(/\\s+/g,' ').trim() || '',
                warn: (c.querySelector('.plan-warn')||{}).textContent?.replace(/\\s+/g,' ').trim() || '',
                tone: [...c.classList].filter(x => x.startsWith('tone-')).join(','),
                facts: [...c.querySelectorAll('.facts > div')].map(d =>
                    d.querySelector('dt').textContent.trim() + ': ' + d.querySelector('dd').textContent.trim()),
                rows: [...c.querySelectorAll('.data-table tbody tr')].map(r =>
                    [...r.querySelectorAll('th,td')].map(x => x.textContent.replace(/\\s+/g,' ').trim()).join(' | ')
                    + ([...r.classList].includes('is-featured') ? '   <== BEST' : '')
                    + ([...r.classList].includes('is-out') ? '   (dimmed)' : '')),
            })),
            error: t('.inline-error'),
            saveNote: t('#saveNote'),
            disclaimer: document.querySelectorAll('.footer-disclaimer').length,
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            scroll: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
        };
    }""")


def run(page, name, *, url="plan/", form=None, shot=True, click_plan=True):
    page.goto(BASE + url, wait_until="networkidle")
    for sel, val in (form or {}).items():
        el = page.locator(sel)
        if el.evaluate("e => e.tagName") == "SELECT":
            page.select_option(sel, val)
        else:
            el.fill(val)
    if click_plan:
        page.click("#planBtn")
        page.wait_for_timeout(300)
    report[name] = scrape(page)
    if shot:
        page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
    return report[name]


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("requestfailed", lambda r: failed.append(f"{r.url} {r.failure}"))

    # A live protocol: 10 mg CJC/ipamorelin blend, 3 ml BAC water, 0.167 mg
    # (a 10-unit draw), nightly, 13 weeks on and 4 off. blend_gh1 is dosed in
    # MILLIGRAMS - typing the mcg figure here is how the first run of this
    # driver reported "167 mg is more than a 10 mg vial holds", which was the
    # page being right and the fixture being wrong.
    jo = {
        "#peptide": "blend_gh1", "#vialSize": "10", "#reconMl": "3",
        "#doseAmount": "0.167", "#dosesPerWeek": "7",
        "#mixDate": "2026-08-06", "#startDate": "2026-07-17",
        "#weeksOn": "13", "#weeksOff": "4",
    }
    # A mcg-scale record, to prove both dose units render.
    bpc = {
        "#peptide": "bpc157", "#vialSize": "5", "#reconMl": "3",
        "#doseAmount": "500", "#dosesPerWeek": "7",
        "#mixDate": "2026-08-06", "#startDate": "2026-08-01",
        "#weeksOn": "4", "#weeksOff": "2",
    }
    run(page, "01-live-protocol", form=jo)
    run(page, "02-empty")
    run(page, "03-deep-link", url="plan/?p=bpc157")
    run(page, "04-no-peptide", form={"#peptide": ""})
    run(page, "05-sterile-water", form={**jo, "#diluent": "sterile"})
    run(page, "05b-mcg-record", form=bpc)
    run(page, "06-small-barrel", form={**bpc, "#syringe": "30", "#doseAmount": "1000"})
    run(page, "07-impossible-dose", form={**jo, "#doseAmount": "99000"})
    run(page, "08-logged-count", form={**jo, "#dosesTaken": "12"})

    # Save round trip: write, reload, confirm it came back.
    page.goto(BASE + "plan/", wait_until="networkidle")
    for sel, val in jo.items():
        el = page.locator(sel)
        (page.select_option(sel, val) if el.evaluate("e => e.tagName") == "SELECT" else el.fill(val))
    page.click("#saveBtn")
    saved_note = page.text_content("#saveNote").strip()
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(400)
    report["09-save-roundtrip"] = {
        "noteAfterSave": saved_note,
        "noteAfterReload": page.text_content("#saveNote").strip(),
        "doseRestored": page.input_value("#doseAmount"),
        "mixDateRestored": page.input_value("#mixDate"),
        "renderedWithoutClicking": page.locator(".plan-card").count(),
        "urlHasNoState": page.url,
    }
    page.click("#clearBtn")
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(300)
    report["10-after-clear"] = {
        "doseAfterClear": page.input_value("#doseAmount"),
        "cards": page.locator(".plan-card").count(),
    }
    ctx.close()

    # Phone, light and dark.
    for label, dark in (("11-mobile-light", False), ("12-mobile-dark", True)):
        ctx = browser.new_context(viewport={"width": 390, "height": 844},
                                  color_scheme="dark" if dark else "light")
        p2 = ctx.new_page()
        p2.on("console", lambda m: errors.append(f"{label} {m.type}: {m.text}") if m.type == "error" else None)
        p2.goto(BASE + "plan/", wait_until="networkidle")
        for sel, val in jo.items():
            el = p2.locator(sel)
            (p2.select_option(sel, val) if el.evaluate("e => e.tagName") == "SELECT" else el.fill(val))
        p2.click("#planBtn")
        p2.wait_for_timeout(300)
        report[label] = scrape(p2)
        p2.screenshot(path=str(OUT / f"{label}.png"), full_page=True)
        ctx.close()

    browser.close()

payload = json.dumps({"console_errors": errors, "failed_requests": failed, "report": report},
                     indent=1, ensure_ascii=False)
# Windows consoles default to cp1252 and die on an arrow, so write bytes rather
# than letting print() encode.
sys.stdout.buffer.write(payload.encode("utf-8") + b"\n")
