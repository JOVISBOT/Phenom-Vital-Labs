"""Drive the generated reference pages and the email gate in a real browser.

Not a substitute for the unit tests: this is here to catch the things a string
assertion cannot -- a stylesheet that never loads, a module that throws on a
page that does not have the calculator's DOM, a modal that opens behind the
content, a table that overflows a phone.

Usage:  python tools/drive-pages.py [base_url] [out_dir]
"""
import sys
import json
import pathlib
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/").rstrip("/") + "/"
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "shots")
OUT.mkdir(exist_ok=True)

errors = []
report = {}


def watch(page, label):
    page.on("console", lambda m: errors.append(f"{label}: console.{m.type}: {m.text}")
            if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"{label}: pageerror: {e}"))
    page.on("requestfailed", lambda r: errors.append(f"{label}: failed {r.url}"))


def shot(page, name, full=True):
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch()

        # --- the directory hub -------------------------------------------
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        watch(page, "hub")
        page.goto(BASE + "p/", wait_until="networkidle")
        rows = page.eval_on_selector_all(".data-table tbody tr", "els => els.length")
        sections = page.eval_on_selector_all(".card h2", "els => els.map(e => e.textContent.trim())")
        report["hub"] = {"rows": rows, "sections": sections}
        shot(page, "pages-hub")

        # --- one peptide page, desktop -----------------------------------
        for pid in ("blend_gh1", "bpc157", "hcg", "dulaglutide"):
            watch(page, pid)
            page.goto(f"{BASE}p/{pid}/", wait_until="networkidle")
            report[pid] = {
                "title": page.title(),
                "h1": page.inner_text("h1"),
                "answer": page.inner_text(".answer-lede"),
                "working": page.inner_text(".working"),
                "faqs": page.eval_on_selector_all(
                    ".faq summary", "els => els.map(e => e.textContent.trim())"),
                "tables": page.eval_on_selector_all(".data-table", "els => els.length"),
                # A stylesheet that 404s leaves this at the browser default.
                "styled": page.eval_on_selector(
                    ".answer-card",
                    "e => getComputedStyle(e).borderTopWidth"),
            }
            shot(page, f"pages-{pid}")

        # --- the CTA actually lands on a calculated result ----------------
        page.goto(f"{BASE}p/blend_gh1/", wait_until="networkidle")
        page.click('a[data-cta="calculator"]')
        page.wait_for_selector(".dose-grid", timeout=8000)
        report["cta"] = {
            "url": page.url,
            "peptide": page.eval_on_selector("#peptide", "e => e.value"),
            "draw": page.eval_on_selector_all(
                ".dose-card .draw-value", "els => els.map(e => e.textContent.trim())"),
        }
        shot(page, "pages-cta-landing")

        # --- phone ---------------------------------------------------------
        phone = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True,
                                 has_touch=True, device_scale_factor=2)
        watch(phone, "mobile")
        phone.goto(f"{BASE}p/bpc157/", wait_until="networkidle")
        report["mobile"] = {
            "overflow": phone.evaluate(
                "() => document.documentElement.scrollWidth > window.innerWidth + 1"),
            "scrollWidth": phone.evaluate("() => document.documentElement.scrollWidth"),
        }
        shot(phone, "pages-mobile-bpc157")
        phone.goto(BASE + "p/", wait_until="networkidle")
        report["mobile_hub_overflow"] = phone.evaluate(
            "() => document.documentElement.scrollWidth > window.innerWidth + 1")
        shot(phone, "pages-mobile-hub")
        phone.close()

        # --- the email gate, with a stubbed endpoint -----------------------
        # config.js ships with provider 'none', so the gate is dark. Patch the
        # module in memory to prove the dialog itself works before it is ever
        # switched on for real.
        gate = browser.new_page(viewport={"width": 1280, "height": 900})
        watch(gate, "gate")
        gate.route("**/js/config.js*", lambda route: route.fulfill(
            status=200, content_type="application/javascript",
            body=(pathlib.Path("js/config.js").read_text(encoding="utf-8")
                  .replace("provider: 'none',\n        endpoint: ''",
                           "provider: 'custom',\n        endpoint: 'https://example.invalid/collect'"))))
        gate.route("https://example.invalid/**", lambda route: route.fulfill(
            status=200, content_type="application/json", body='{"ok":true}'))

        gate.goto(BASE + "?p=blend_gh1&w=165&a=34&v=10&r=3&s=100", wait_until="networkidle")
        gate.wait_for_selector(".dose-grid", timeout=8000)
        gate.click("#downloadPDF")
        gate.wait_for_selector(".modal", timeout=5000)
        # The overlay fades in over 200ms; screenshotting through it makes an
        # opaque dialog look half-transparent and reads as a bug that is not one.
        gate.wait_for_timeout(600)
        report["gate"] = {
            "overlay_opacity": gate.eval_on_selector(".modal-overlay", "e => getComputedStyle(e).opacity"),
            "modal_bg": gate.eval_on_selector(".modal", "e => getComputedStyle(e).backgroundColor"),
            "title": gate.inner_text("#ecTitle"),
            "has_skip": gate.is_visible("#ecSkip"),
            "focused": gate.evaluate("() => document.activeElement.id"),
        }
        shot(gate, "pages-email-gate", full=False)

        # bad address is rejected client-side
        gate.fill("#ecEmail", "not-an-email")
        gate.click("#ecSubmit")
        gate.wait_for_selector("#ecError:not([hidden])", timeout=3000)
        report["gate"]["validation"] = gate.inner_text("#ecError")

        # good address is accepted and the modal closes
        gate.fill("#ecEmail", "jo@example.com")
        gate.click("#ecSubmit")
        gate.wait_for_selector(".modal", state="detached", timeout=8000)
        report["gate"]["stored"] = gate.evaluate("() => localStorage.getItem('pvl.email')")

        # asked once: a second download must not re-open it
        gate.click("#downloadPDF")
        gate.wait_for_timeout(800)
        report["gate"]["reasked"] = gate.is_visible(".modal")
        gate.close()

        browser.close()

    report["console_errors"] = errors
    OUT.joinpath("pages-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"\nconsole/network errors: {len(errors)}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
