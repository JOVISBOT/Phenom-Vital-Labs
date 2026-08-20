# Changelog

## 2.0.0 - 2026-08-20

Fixes all 24 findings from the 2026-08-20 audit. The four P0 items were dosing
defects on a public page, so the headline change is that the numbers are now right.

### P0 - dosing correctness

**1. Syringe units were half the correct value, everywhere.**
`calculateSyringeUnits` used the syringe's *barrel size* as its units-per-millilitre.
A U-100 insulin syringe reads 100 units per ml whether the barrel holds 30, 50 or 100
units - barrel size caps volume, not concentration. `main.js` hardcoded `syringe: 50`,
so every one of the 44 peptides, all three dose tiers, and the PDF export were out by
2x. `UNITS_PER_ML` is now a named constant and the syringe size is a user choice that
affects only the overflow warning.

**2. 26 of 44 peptides multiplied a flat dose by body weight.**
`fixed: false` was read as "micrograms per kilogram" and multiplied by an age-inflated
body weight. The values are flat protocol totals. BPC-157 at 145 lbs returned
**70,165 mcg and 393 vials** against a conventional 250-500 mcg. Dihexa returned
1,122,648 mcg. Doses are now flat by default; `perKg: true` opts a peptide in.

**3. The site had no safety disclaimer.**
`.footer-disclaimer` was fully styled in `styles.css` and rendered nowhere - a public
page emitting per-user injection protocols with no medical language at all. It now
renders on the page and in the PDF, from one shared string.

**4. HCG vial sizes were IU labelled as milligrams**, giving 1,667 mg/ml and a draw
that rounded to **zero units**. Units are now explicit per peptide (`doseUnit`,
`vialUnit`) and the test suite fails if a dose unit and a vial unit disagree.

### Data - schema v2

`fixed` conflated "is a milligram value" with "is not weight-scaled", and the second
half was never true. Replaced with `doseUnit` (`mcg`/`mg`/`IU`), `vialUnit`, explicit
`vialSize`/`vialSizes`, per-peptide `reconMl`, and `components` for blends.

Seven peptides were stored in the wrong unit. Each was corrected against the record's
own instruction text or a universal dosing convention - see `tools/migrate-units.js`
for the evidence behind each one:

| Peptide | Was | Now | Evidence |
|---|---|---|---|
| `hcg` | 0.25/0.5/1 mg | 250/500/1000 IU | its own inst: "250-500 IU typical maintenance" |
| `aicar` | 50/100/200 mcg | 50/100/200 mg | its own inst: "Higher doses (100-200mg)" |
| `nadplus` | 100/250/500 mcg | 100/250/500 mg | its own inst: "Large injection volume" |
| `hmg` | 0.075/0.15/0.3 mg | 75/150/300 IU | gonadotropins are dosed in IU |
| `hgh` | 1/2/4 mg | 1/2/4 IU | somatropin is dosed in IU |
| `epo` | 1000/3000/5000 mcg | 1000/3000/5000 IU | erythropoietin is dosed in IU |
| `glutathione` | 100/200/500 mcg | 100/200/500 mg | injectable glutathione is dosed in mg |

Vial sizes from the April `ENHANCEMENT_PLAN.md` have been applied - that pass had been
stalled awaiting sign-off since 2026-04-21. Items deliberately **not** changed, because
they need a dosing decision rather than a unit fix, are listed in `data/DATA-REVIEW.md`.

### P1

- **Reconstitution volume is now an input.** It was hardcoded to 3 ml in two separate
  files with no control, while being the single biggest determinant of the draw. Each
  peptide carries a default chosen to land the recommended dose near 30 units - a
  legible spot on the barrel. 1/2/3/5 ml offered.
- **Age no longer claims a dose multiplier.** The labels advertised +8/+16/+33% while
  the code applied +10/+20/+35%, and scaling GH-secretagogue doses *up* with age is
  backwards. Weight and age are now recorded for the protocol sheet, and the page says
  so plainly instead of calling the output "personalized".
- **Blends show per-component doses.** 0.4 mg of a 5mg+5mg blend is 200 mcg of *each*;
  showing only the combined figure reads as double against every published convention.
- **`blend_gh1` has a real `vialSize`.** It previously worked only because `ui.js`
  regex-scraped "5mg+5mg" out of the category string - editing that display text would
  have silently broken the dose.
- **Syringe graphic clamps.** `plungerX` was unbounded, so an overflowing dose drew the
  fill, plunger and rod straight through the needle tip. Overflow is now an explicit
  state showing total ml and the number of draws required.
- **`debug.js` removed.** It shipped to production, logged on every visit, and probed
  `#syringe` - an element that had not existed for months.

### P2

- Title was "Peptide Calculator (Refactored)". Added meta description, canonical,
  Open Graph and Twitter cards with a real 1200x630 PNG, `theme-color`.
- Added `favicon.svg`, `404.html`, `robots.txt`, `sitemap.xml`, `manifest.json` - all
  previously 404ing.
- jsPDF now loads with an SRI hash and `crossorigin`.
- Cache-bust tokens had drifted (`main.js?v=27` vs `peptides.json?v=19`); all now v28,
  with `DATA_VERSION` in `dataLoader.js` as the single place to bump the data token.
- Removed 11 dead CSS rules, the dead `nad`/`semaglutide` vial-map keys, the dead
  `semaglutide`/`ipamorelin` ids in the "Popular" group, duplicated `isBlend`, and the
  exported-but-never-called `calculateTotalCost` with its hardcoded $45.
- Animation CSS moved out of a runtime `document.createElement('style')` into
  `styles.css`, plus `prefers-reduced-motion` and print rules - `.animate-in` starts at
  `opacity: 0`, so printing produced a blank page.
- Button icon `path` had no `fill`/`stroke` and rendered as a black blob.
- `css/styles-label-icon.css` defined `.label-icon`, which `index.html` used, but was
  never linked. Merged into `styles.css`.
- Deleted unreferenced `data/peptides-sample.json` and `data/peptides-raw.txt`.
- README documented a file that does not exist and an example the code contradicted.

### Added

- **Tests.** `node --test test/calculator.test.mjs` - 15 tests, no dependencies:
  schema invariants, the dose model, and a golden snapshot of all 44 peptides x 3
  tiers. Every defect above fails at least one of them. The snapshot caught a real bug
  during this work: `performCalculation` ignored a peptide's own `reconMl`.
- **`tools/drive-ui.py`** - Playwright driver that exercises the real page and reports
  what actually renders, including the overflow state, the PDF byte count, mobile
  overflow and console errors.
- Shareable URL state (`?p=bpc157&v=5&r=2&s=100`) and a Copy link button.
- Escaping on everything written to `innerHTML`.
- Labels bound to inputs via `for`/`id`, `role="alert"` on errors, `aria-label` on the
  syringe graphic.
