"""Drive the real page in Chromium and capture what a user actually sees.

Usage:  python tools/drive-ui.py [base_url] [out_dir]
"""
import sys, json, pathlib
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/"
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "shots")
OUT.mkdir(exist_ok=True)

errors = []
report = {}


def run(page, name, peptide, *, recon=None, syringe=None, vial=None, shot=True):
    page.goto(BASE, wait_until="networkidle")
    page.select_option("#peptide", peptide)
    if vial:
        page.select_option("#vialSize", str(vial))
    if recon:
        page.select_option("#reconMl", str(recon))
    if syringe:
        page.select_option("#syringe", str(syringe))
    page.click("#calculateBtn")
    page.wait_for_selector(".dose-grid", timeout=5000)

    cards = page.eval_on_selector_all(
        ".dose-card",
        """els => els.map(e => ({
            tier: e.querySelector('.dose-label').textContent.trim(),
            dose: e.querySelector('.mcg-value').textContent.trim(),
            draw: e.querySelector('.draw-value').textContent.trim(),
            hint: e.querySelector('.draw-hint').textContent.trim(),
            overflow: !!e.querySelector('.draw-box.overflow'),
            exceedsVial: (e.querySelector('.draw-label')||{}).textContent?.includes('vial holds') || false,
            components: [...e.querySelectorAll('.component-split div')].map(d => d.textContent.trim())
        }))""",
    )
    report[name] = {
        "summary": page.text_content(".summary-title p").strip(),
        "cards": cards,
        "vials": page.text_content(".info-card.highlight .big").strip(),
        "calc": " | ".join(t.strip() for t in page.eval_on_selector_all(".calc-steps li", "e => e.map(x=>x.textContent)")),
        "url": page.url,
        "disclaimer": page.locator(".footer-disclaimer").count(),
    }
    if shot:
        # Cards fade in on a stagger up to 1.1s; screenshot before that and the
        # page looks half-empty for reasons that have nothing to do with layout.
        page.wait_for_function(
            "[...document.querySelectorAll('.animate-in')].every(e => getComputedStyle(e).opacity === '1')",
            timeout=5000)
        page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
    return report[name]


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

    # Empty state
    page.goto(BASE, wait_until="networkidle")
    page.screenshot(path=str(OUT / "00-form.png"), full_page=True)
    report["form"] = {
        "peptideOptions": page.eval_on_selector_all("#peptide option", "e => e.length"),
        "fields": page.eval_on_selector_all(".form-field label", "e => e.map(x => x.textContent.trim())"),
        "vialDisabled": page.is_disabled("#vialSize"),
        "disclaimerVisible": page.is_visible(".footer-disclaimer"),
    }

    run(page, "01-blend-gh1", "blend_gh1")          # per-component split, Jo's own stack
    run(page, "02-bpc157", "bpc157")               # was 70,165 mcg / 393 vials
    run(page, "03-hcg", "hcg")                     # was 0 units
    run(page, "04-aicar-overflow", "aicar", syringe=30)   # overflow state
    run(page, "05-nadplus", "nadplus")             # was mcg, now mg
    run(page, "06-dihexa", "dihexa")               # was 15,718 vials
    # Records rewritten in the 2026-08-20 data-review pass
    run(page, "09-cagrilintide", "cagrilintide")   # was 100/200/400 mcg, now 1.2/2.4/4.5 mg
    run(page, "10-retatrutide", "retatrutide")     # was 1/2/4 mg, now the 4/8/12 trial arms
    run(page, "11-tirzepatide", "tirzepatide")     # high 10 -> 15 mg, vial 10 -> 20 mg
    run(page, "12-blend-heal-20", "blend_heal_20") # tiers halved to match blend_heal
    run(page, "13-tb500", "tb500")                 # inst claimed 10mg/wk
    run(page, "14-thymalin", "thymalin")           # 10-day course, not 14
    run(page, "15-hmg-exceeds", "hmg")             # high tier needs 2 vials per dose

    # URL round-trip
    shared = report["01-blend-gh1"]["url"]
    page.goto(shared, wait_until="networkidle")
    page.wait_for_selector(".dose-grid", timeout=5000)
    report["urlRoundTrip"] = {
        "restored": page.input_value("#peptide"),
        "recon": page.input_value("#reconMl"),
        "med": page.text_content(".dose-card.med .draw-value").strip(),
    }

    # PDF actually generates
    page.goto(BASE + "?p=bpc157", wait_until="networkidle")
    page.wait_for_selector(".dose-grid", timeout=5000)
    pdf_bytes = page.evaluate("""async () => {
        const mod = await import('./js/pdfGenerator.js');
        const calc = await import('./js/calculator.js');
        const data = await (await fetch('./data/peptides.json')).json();
        const p = data.peptides.find(x => x.id === 'bpc157');
        const results = calc.performCalculation(p, {weightLbs:180});

        // Hook the constructor rather than the prototype: jsPDF attaches save()
        // as an instance method, so patching the prototype never intercepts it.
        const Real = window.jspdf.jsPDF;
        let doc = null;
        window.jspdf.jsPDF = function(...a){ doc = new Real(...a); doc.save = () => {}; return doc; };
        window.jspdf.jsPDF.prototype = Real.prototype;
        try { mod.generatePDF(p, results, {weight:180, age:35}, false); }
        finally { window.jspdf.jsPDF = Real; }
        return doc ? doc.output('arraybuffer').byteLength : 0;
    }""")
    report["pdfBytes"] = pdf_bytes

    # Mobile
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(BASE + "?p=blend_gh1", wait_until="networkidle")
    page.wait_for_selector(".dose-grid", timeout=5000)
    page.wait_for_function(
        "[...document.querySelectorAll('.animate-in')].every(e => getComputedStyle(e).opacity === '1')",
        timeout=5000)
    page.screenshot(path=str(OUT / "07-mobile.png"), full_page=True)
    report["mobileOverflowX"] = page.evaluate("document.documentElement.scrollWidth > window.innerWidth")

    # 404
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(BASE + "404.html", wait_until="networkidle")
    page.screenshot(path=str(OUT / "08-404.png"), full_page=True)

    browser.close()

report["consoleErrors"] = errors
print(json.dumps(report, indent=2))
