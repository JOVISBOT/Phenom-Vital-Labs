# Changelog

## 2.1.0 - 2026-08-20

Closes every open item in `data/DATA-REVIEW.md`. Those were parked by the v2 pass
because correcting them meant *picking a dose* rather than fixing a unit. Each dose
below is anchored to a published trial arm or a stated clinical convention, and the
citation lives on the change in `tools/apply-data-review.js`.

Sweeping all 44 records for the same bug classes turned up five more defects the
review had not caught, marked NEW.

### Doses that did not match published protocols

- **`cagrilintide` was ~12x under-dosed and in the wrong unit.** Stored 100/200/400
  **mcg**; the Phase 2 trial (n=706, 26 wks) randomised 0.3, 0.6, 1.2, 2.4 and 4.5
  **mg** weekly. Now 1.2/2.4/4.5 mg. The v2 unit sweep missed it because 100 mcg is
  a plausible number in isolation - it only reads as wrong against the trial.
- **`retatrutide` `high` was below its own instruction text.** Stored 1/2/4 mg while
  the record already said "Week 13+: 9-12mg weekly". Now 4/8/12 mg, the Phase 2 arms
  (NEJM 2023, n=338, 48 wks).
- **`bpc157` med/high were 2x and 4x the cited range (NEW).** 250-500 mcg/day is the
  commonly cited range; stored 500/1000/2000 mcg. Now 250/500/1000, with the top tier
  labelled as an acute protocol split AM/PM. Its `reconMl` also contradicted its own
  "reconstitute with 3ml" instruction, and now matches.
- **`tb500` instructions claimed 10mg/week.** "Maintenance: 5mg twice weekly" is
  roughly 4x the cited maintenance dose and double the loading dose. Rewritten to the
  real loading/maintenance split; tiers now 1000/2000/2500 mcg.

Vial and water defaults moved where the old default could no longer be drawn:
cagrilintide 5mg/3ml -> 10mg/2ml (2.4mg was 144 units, past a 100u barrel),
retatrutide 10mg -> 30mg (12mg exceeded the vial outright).

### Records that argued with themselves

- **`blend_heal_20` was double-dosing.** Its tiers were exactly twice `blend_heal`
  for the same two peptides. Dose is a property of the patient, not the vial - the
  20mg vial is twice as concentrated, so it buys a smaller injection volume, not a
  bigger dose. Tiers now match `blend_heal` (0.5/1.0/1.5 mg). Renamed "(High Dose)"
  -> "(20mg vial)", which is what it actually is.
- **`blend_heal` med delivered 3.75mg/wk of TB-500** - loading-phase dosing held for
  six straight weeks. Its inst text (500mcg of each, 2.5mg/wk, the maintenance dose)
  was the correct reading, so the dose fields moved to meet it.
- **`blend_gh1` high was 400mcg of each**, above the 100-300mcg convention, while the
  inst quoted the 300mcg ceiling as "typical". High now 300mcg of each, and the note
  that CJC-1295 no-DAC saturates the GHRH receptor near 1mcg/kg is stated on the record.
- **`cagrisema` named half the real starting dose (NEW)** - "0.25mg total" where the
  start is 0.25mg of *each*. Low tier 1 -> 0.5 mg.
- **`tirzepatide` capped below its own stated max (NEW).** Inst said "Week 13+:
  10-15mg weekly (max)" against a 10mg high tier. Now 15mg, with the vial 10 -> 20mg
  so the dose can actually be drawn.
- **`glutathione` pointed at an IV dose (NEW).** "For skin: higher doses
  (1500-2000mg)" against a 500mg high tier and a 600mg vial. Qualified as IV infusion,
  out of scope for a subcutaneous draw.

### New bug class: a dose larger than the vial

`PLAUSIBLE_UNITS` only checked the **recommended** tier, so four records shipped a
`high` tier needing more peptide than one reconstituted vial holds. This is not
syringe overflow - overflow is fixable with a bigger barrel or less water, but
**water dilutes, it does not add peptide.**

- `dulaglutide` was a plain defect and is fixed **(NEW)**: its 4.5mg high tier is a
  real Trulicity strength and 4.5 was already in `vialSizes`, just not the default.
- `aicar`, `dihexa` and `hmg` are now **surfaced instead of silently wrong**. The card
  reads "More than one 100mg vial holds / 2 vials" and explains why no water volume
  fixes it. Left uncorrected on purpose: either the tier is too high or the record is
  missing a larger vial that really is sold, and neither reading is sourced.
- New `exceedsVial` / `perDoseVials` on the result object, rendered on the card and in
  the exported PDF, and pinned by `EXCEEDS_VIAL_AT_HIGH` so a fourth cannot appear
  unnoticed.

### Cycles stated in days

`f` x `wks` cannot express a course that is not a whole number of weeks. Added
`dosesPerCycle`, which wins when present: `thymalin` 14 -> **10** doses (7 -> 5 vials),
`cortagen` and `crystagen` 21 -> **20** doses (11 -> 10 vials). The `thymalin` case was
explicitly deferred in 2.0.1 as "over-reports by four, which is the safe direction" -
it is now simply correct. Injection count is shown on the Cycle card and the PDF.

### Tests

15 -> 18. The three new ones close the gaps that let the above ship:

- every tier must be drawable from one vial, or be a *named* exception
- a dose bigger than the vial must be flagged, and the recommended tier never may be
- `dosesPerCycle` overrides only where a day-stated course needs it, nowhere else

Blend detection no longer keys on the word "blend" - `cagrisema` is two actives in one
vial and its category reads "Dual Weight Loss Combo (2.5mg+2.5mg)". Any record
advertising "<n>mg + <n>mg" is now required to carry a component split.

`DATA_VERSION` 29 -> 30 so corrected data is not served from cache.

Verified at this commit: 18/18 tests pass, and `tools/drive-ui.py` drove the real page
in Chromium across 16 scenarios with zero console errors - cagrilintide 24/48/90 units,
retatrutide 26.7/53.3/80, tirzepatide 12.5/25/75, blend_heal_20 split showing 500mcg of
each at the recommended tier, thymalin reporting 5 vials and "10 injections in full",
HMG and AICAR showing the new exceeds-vial card, PDF generating at 27 KB, no mobile
overflow, shared URLs round-tripping.

## 2.0.1 - 2026-08-20

Follow-up pass after re-verifying every finding against the running code.

- **`cortagen` and `crystagen` dosed once a week while claiming to be daily.** Both
  records carried `f: 1` against their own `freq: "Daily"` and `cycle: "20 days every
  6 months"` - a record arguing with itself, so it was corrected rather than left as a
  content decision. `f: 1 -> 7`. Vials needed for a cycle went 2 -> 11. The rest of the
  44 records were swept for the same `freq`-vs-`f` contradiction; no other genuine case.
- Golden snapshot updated (it caught the change unprompted - exactly what it is for).
- `DATA_VERSION` bumped 28 -> 29 so the corrected data is not served from cache.
- `data/DATA-REVIEW.md` section 3 closed; `thymalin` documented as deliberately left,
  since it over-reports by four doses and that is the safe direction.

Re-verified end to end at this commit: 15/15 tests pass, the SRI hash on jsPDF matches
the live CDN file byte-for-byte, and `tools/drive-ui.py` drove the real page in Chromium
with zero console errors - blend 6/12/24 units, BPC-157 500/1000/2000 mcg, HCG 250 IU at
15 units (was 0), AICAR showing the clamped overflow state, PDF generating at 27 KB.

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
