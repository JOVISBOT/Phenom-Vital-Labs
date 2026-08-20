# Peptide data - review log

Companion to `tools/migrate-units.js` (schema v2, unit fixes) and
`tools/apply-data-review.js` (schema v3, dose fixes).

The v2 pass fixed everything that was a *unit* error and deliberately stopped at
anything that meant picking a dose. This file recorded those deferrals. **They
were signed off and applied on 2026-08-20**; what follows is the record of what
changed and, at the bottom, what is genuinely still open.

Supersedes `ENHANCEMENT_PLAN.md` and `PEPTIDE_VERIFICATION_NEEDED.md`.

---

## RESOLVED 2026-08-20

### 1. Doses that did not match published protocols

| Peptide | Was | Now | Anchor |
|---|---|---|---|
| `cagrilintide` | 100/200/400 **mcg** | 1.2/2.4/4.5 **mg** | Phase 2 (n=706, 26wk) arms: 0.3, 0.6, 1.2, 2.4, 4.5 mg weekly |
| `retatrutide` | 1/2/4 mg | 4/8/12 mg | Phase 2 (n=338, 48wk, NEJM 2023) arms: 1, 4, 8, 12 mg weekly |
| `bpc157` **(NEW)** | 500/1000/2000 mcg | 250/500/1000 mcg | cited range is 250-500 mcg/day; med was 2x and high 4x that |
| `tb500` | 750/1500/3000 mcg | 1000/2000/2500 mcg | loading 2-2.5mg 2x/wk, maintenance 2-2.5mg/wk |

Cagrilintide was wrong in unit *and* magnitude - a 12x under-report that the v2
unit sweep missed because 100 mcg is a plausible number in isolation.

Vial and water defaults moved with the doses where the old default could no
longer be drawn: cagrilintide 5mg/3ml -> 10mg/2ml (the 2.4mg dose was 144u, past
a 100u barrel), retatrutide 10mg -> 30mg (12mg exceeded the vial outright).

### 2. Instruction text that contradicted the dose fields

| Peptide | Contradiction | Resolution |
|---|---|---|
| `blend_gh1` | high = 400mcg each; inst quoted 300mcg as "typical" | high -> 0.6mg (300 each). Convention is 100-300 mcg of each; 300 is the ceiling, not the norm. Saturation note added. |
| `blend_heal` | med = 750mcg each = 3.75mg/wk TB-500 | tiers -> 0.5/1.0/1.5. The inst text (500mcg each = 2.5mg/wk, TB-500's maintenance dose) was right; the dose fields moved to it. |
| `blend_heal_20` | tiers were double `blend_heal` for the same two peptides | tiers -> 0.5/1.0/1.5, identical to `blend_heal`. The 20mg vial is twice as concentrated - same dose, half the volume. Renamed from "(High Dose)" to "(20mg vial)", which is what it actually is. |
| `tb500` | inst said 5mg twice weekly = 10mg/wk | inst rewritten to the loading/maintenance split. 10mg/wk was ~4x maintenance and 2x loading. |
| `cagrisema` **(NEW)** | inst said "0.25mg total" | the real start is 0.25mg of *each* = 0.5mg total; low tier 1 -> 0.5 |
| `glutathione` **(NEW)** | inst named 1500-2000mg against a 500mg high tier | qualified as IV infusion, out of scope for a subq/IM draw - and more than three of its own vials |
| `tirzepatide` **(NEW)** | inst named 15mg as max, high was 10mg | high -> 15mg, vial 10 -> 20mg so it can be drawn |

### 3. Cycles stated in days

`f` x `wks` cannot express a course that is not a whole number of weeks. Added an
explicit `dosesPerCycle` that wins when present:

| Peptide | Protocol | `f` x `wks` said | Now |
|---|---|---|---|
| `thymalin` | "10mg daily for 10 days" | 14 doses / 7 vials | **10 doses / 5 vials** |
| `cortagen` | "20-day course" | 21 doses / 11 vials | **20 doses / 10 vials** |
| `crystagen` | "20-day course" | 21 doses / 11 vials | **20 doses / 10 vials** |

### 4. NEW bug class: a dose larger than the vial

The old `PLAUSIBLE_UNITS` test only checked the **recommended** tier, so four
records shipped a `high` tier needing more peptide than one reconstituted vial
holds. This is not the same as syringe overflow: overflow is fixable by picking a
bigger barrel or less water, but no water volume fixes this - **water dilutes, it
does not add peptide.**

`dulaglutide` was a plain defect and is fixed: its 4.5mg high tier is a real
Trulicity strength and 4.5mg was already in `vialSizes`, it just was not the
default. Fixed by making it the default.

The other three are now **surfaced rather than silently wrong** - the card reads
"More than one 100mg vial holds / 2 vials" and says why. See OPEN below.

### 5. Marketing copy

Header now reads "Research use only". Any purity claim that goes back must point
at actual certificates of analysis.

---

## RESOLVED 2026-08-20 (v4) - the four items this file left open

Applied by `tools/apply-open-items.js`. The v3 pass stopped wherever it lacked
evidence; this pass went and got it. Sources sit on each change in that script.

### OPEN 1 - three `high` tiers exceeded the largest vial offered

Two were wrong doses. One was right, and the *vial* was wrong.

| Peptide | Was | Now | Why |
|---|---|---|---|
| `aicar` | 50/100/200 mg, 8 wks | **10/25/50 mg, 2 wks** | 50/100/200 matched no published protocol. Sources converge on ~25 mg/day standard (1-3 mg at the low end) and cap the run at ~14 days with a 1-2 month washout. 200 mg/day x 56 days is 11.2 g - which is exactly why the high tier needed two vials. |
| `dihexa` | 8/16/32 mg | **2/3/5 mg** | 8-45 mg is the **oral** range. Subcutaneous community protocols run 2-5 mg daily. This is a syringe calculator, so it needs the subq figure - the same defect already fixed on `glutathione`, where an IV dose was being drawn into an insulin syringe. |
| `hmg` | 150 IU default vial | **75 IU default, `multiVial: true`** | Not a defect. MENOPUR is supplied in the US only as 75 IU vials, and its instructions for use say to mix the first vial with 1 ml, draw it back up, and dissolve up to five more in that same liquid. 300 IU genuinely is four vials. |

**The pooling model matters.** Reconstituting N vials does **not** multiply the
volume - it multiplies the concentration. Modelling hmg's 300 IU as "4 vials,
therefore 4 ml" would have told a user to pull **400 units** on a 100u barrel.
`vialsPooled()` handles it, and `multiVial` is now the only licence to exceed one
vial per dose: a record cannot re-enter that state by being added to a list.

**Found by reading the rendered page, not the test output:** with pooling in, the
calculation box printed `75 IU/ml` and `1 ml` for a 150 IU dose - two individually
correct numbers that together said 150 / 75 = 1. `concentrationAt` now carries the
per-tier figure, and a test asserts the concentration shown is the one the volume
was divided by.

### OPEN 2 - fourteen vial sizes were convention, not evidence

Not fixed by guessing better. **The vial-size control now accepts a typed value**,
so the number in force is the one printed on the user's own vial. Vial size sets
how far up the barrel a dose lands, not how much peptide is in it, so a wrong
catalogue was a legibility bug - and a typed value removes the catalogue from the
answer entirely. Custom sizes survive a shared link.

Fallout, caught on screen: selecting a 7.5 mg vial left BPC-157's own protocol
sheet reading "Reconstitute 5mg vial with 3ml bacteriostatic water" directly under
a 7.5 mg header. One record did this; the line is rewritten and a test now rejects
any instruction that hardcodes a figure the form owns.

### OPEN 3 - `dulaglutide` does not reconstitute

Trulicity is a single-dose pre-filled pen: no powder, no bacteriostatic water, no
draw. Records can now declare `noRecon`, and every draw field comes back **null**
so nothing downstream can render one by accident. The page swaps the syringe
guide for a "No Draw To Calculate" panel, relabels the control "Pen Strength",
disables water and syringe, and counts **pens** rather than vials (one single-dose
device per injection). The PDF does the same.

### OPEN 4 - no dose was labelled by how well it is evidenced

One blanket disclaimer covered all 44 records equally, flattening a Mounjaro label
strength and a forum figure for a compound that has never been in a human into the
same claim. Every record now carries an `evidence` class, shown on the card and
printed in the PDF disclaimer:

| Class | Meaning | Count |
|---|---|---|
| `approved` | An FDA-approved product with this active is marketed; tiers anchored to its labelled strengths | 8 |
| `trial` | Published human trial data at comparable doses; not approved for this use | 12 |
| `convention` | No human dosing study at all - vendor and forum figures from animal work | 24 |

A test requires all three classes to stay populated (a dropped field would
silently make everything `convention` and the label would stop discriminating),
and pins the thinnest-evidence compounds to `convention` so they cannot be
over-claimed.

---

## RESOLVED 2026-08-20 (v5, v6) - the vial catalogue, and what the badge may claim

Applied by `tools/apply-vial-sources.js` and `tools/apply-dose-anchors.js`.

### v5 - every vial size now says where it came from

The v4 answer to "the catalogue is unsourced" was to let the user type their own
size, which takes the catalogue out of the *arithmetic*. It does not take it off
the *screen*: the dropdown still showed a column of numbers with nothing to
distinguish a strength printed on an FDA carton from one copied off a vendor's
shop page.

Sourced against the openFDA NDC directory (2026-08-19) and, where the NDC entry
is a kit and carries no strength, the FDA label's HOW SUPPLIED section:

| Peptide | Catalogue was | Marketed strengths | Result |
|---|---|---|---|
| `dulaglutide` | 0.75 / 1.5 / 3 / 4.5 mg | the same four | **label** - the only fully anchored record |
| `tirzepatide` | 5-80 mg | 2.5 / 5 / 7.5 / 10 / 12.5 / 15 mg | three real strengths were **missing**; six offered sizes match no product |
| `tesamorelin` | 2 / 5 / 10 / 20 mg | 2 mg (EGRIFTA SV), 11.6 mg (EGRIFTA WR) | WR's vial was **absent entirely** |
| `hcg` | 1,000 / 2,000 / 5,000 / 10,000 IU | 5,000 and 10,000 USP units | the two smallest match no US product |
| `hmg` | 75 / 150 IU | 75 IU only | which is *why* this record pools vials |
| `hgh` | 10 / 12 / 15 / 24 / 36 IU | 15, 18, 36, 72 IU | 18 and 72 were missing (Humatrope 6 and 24 mg) |
| `epo` | 1,000-10,000 IU | 2,000 to 40,000 IU/ml | a **1,000 IU that does not exist**; the two largest missing |
| `pt141` | 5 / 10 mg | none | see below |

Marketed strengths were **added** rather than merely flagged - the point is that
the real sizes are present. Sizes with no approved counterpart stay, tagged,
because a compounded or research vial is still a vial someone holds.

**PT-141 inverts the exercise.** Bremelanotide *is* approved - as Vyleesi, a
1.75 mg / 0.3 ml pre-filled autoinjector. There is no approved vial of it at any
size, so the catalogue stays vendor-only and the note says exactly that. Adding
1.75 to a list of vial sizes would have implied a vial nobody sells.

Counts: **1 label, 6 mixed, 37 vendor.** A test derives the class from the sizes
rather than trusting the field, so a record cannot be tagged `label` while
offering a size no product uses.

### v6 - the `approved` badge was making two claims, and only one was true

Found by reading the rendered PT-141 page after v5 shipped. It said, at once:

- **FDA-APPROVED DRUG** - "the doses here are anchored to its labelled strengths"
- **None of these sizes is a marketed strength** (the v5 note, correct)
- **MAXIMUM DOSE 2.5 mg** - 43% above the only labelled dose
- *"Can increase to 1000-1500mcg if tolerated"* - its own text, capping at 1.5 mg

Four claims about one compound, no two agreeing. The badge sentence was written
once for eight records and is true of four.

**Three tier sets moved onto their anchors:**

| Peptide | Was | Now | Anchor |
|---|---|---|---|
| `pt141` | 0.5 / 1.5 / 2.5 mg | **0.5 / 1 / 1.75 mg** | VYLEESI label: 1.75 mg SC, max one dose per 24h, max 8 doses a month |
| `tesamorelin` | 1 / 2 / 2.5 mg | **1.28 / 1.4 / 2 mg** | the labelled daily doses of EGRIFTA WR, EGRIFTA SV and the original EGRIFTA. Not a ladder - the SV label states 1.4 mg and 2 mg give similar Cmax and AUC |
| `ara290` | 2 / 4 / 6 mg | **1 / 4 / 8 mg** | phase 2 in painful sarcoid neuropathy randomised 1, 4 and 8 mg daily for 28 days; the nerve-regrowth signal was at 4 mg |

**And the claim itself is now per record.** New `doseAnchor`, on approved records
only:

| | Meaning | Records |
|---|---|---|
| `label` | no tier exceeds a dose or strength on the approved label | dulaglutide, tirzepatide, tesamorelin, pt141 |
| `protocol` | community or off-label practice; the label prints different figures for a different purpose | hcg, hmg, hgh, epo |

The badge now reads "FDA-approved, label dose" or "FDA-approved, off-label dose"
and carries the matching sentence, on the card and in the PDF.

### The guard that could not fire

The regression test written for the PT-141 contradiction - *no instruction may
state a ceiling below the tier the page offers* - shipped with a stray control
character where a word boundary belonged, so its pattern matched nothing and it
passed unconditionally. Repaired, then **proved against the pre-fix text**: it
fails on "increase to 1000-1500mcg" beside a 2.5 mg tier, and passes on the
corrected line. A guard that has never been shown to fail is not a guard.

---

## STILL OPEN

**1. Vial sizes for the 37 vendor-class records remain unsourceable.** Not for
want of looking: no approved product contains those compounds, so there is no
label to check them against. They are now *stated* to be vendor convention on
the screen and in the PDF, and the typed-size control means the catalogue never
has to be right. This is disclosed rather than fixed, and cannot be fixed.

**2. No dose here is validated for human use.** Unchanged, and now stated at two
levels: how well the compound is evidenced (`evidence`) and whether the specific
figures come off a label (`doseAnchor`). The `trial` anchors (cagrilintide,
retatrutide, ara290) are trial arms from supervised settings, not
self-administration guidance. BPC-157 and TB-500 have no human dosing study at
all, and the FDA compounding advisory committee voted 11-3 against adding either
to the 503A bulks list in July 2026.

**3. Four records are approved drugs dosed off-label here** (hcg, hmg, hgh,
epo). That is now labelled rather than hidden, but the figures themselves are
still community practice. Anchoring them would mean changing what the site is
for, which is a decision about the product, not a defect to fix.

---

## SECOND INDEPENDENT PASS - 2026-08-20 (schema v7/v8)

Run by `tools/verify-data.js`, deliberately written without reading `test/`
first: assertions written alongside the fix they guard can only confirm what was
already known. It walks every record and every vial x water combination the UI
can reach (620), and it now runs as part of `npm test`.

### Found: thirteen ranges published as single facts

| Record | Prose | Stored | Published as | Actually |
|---|---|---|---|---|
| `cjc1295_nodac` | 1-3x daily | f=21 | 252 inj, 51 vials | **84-252 inj, 17-51 vials** |
| `aod9604` `frag1723` `ghrp2` `ghrp6` `hexarelin` | 2-3x daily | f=21 | ceiling | 14-21/wk |
| `nadplus` `ara290` | Daily or 3x weekly | f=7 | ceiling | 3-7/wk |
| `glutathione` `motsc` `pegmgf` | 2-3x weekly | f=3 | ceiling | 2-3/wk |
| `follistatin` | 1-2x weekly | f=2 | ceiling | 1-2/wk |
| `melanotan2` | Every 2-3 days | f=3 | midpoint | 2.33-3.5/wk |
| `ace031` | 4-8 weeks | wks=6 | midpoint | 4-8 |
| `dihexa` | 4-6 weeks | wks=6 | **ceiling** | 4-6 |
| `hmg` | 3-6 weeks | wks=4 | **near floor** | 3-6 |

The last three matter as a set: a point estimate picked three different ways is
not a convention. `fMin`/`fMax` and `wksMin`/`wksMax` now carry the range and
the UI, the generated pages, the FAQ JSON-LD and the PDF all render it.

Fourteen more records name no cadence or no window at all -- "Multiple daily",
"Continuous OK", "As needed", "6 months minimum". Their `f`/`wks` are house
assumptions and now say so via `fAssumed`/`wksAssumed`.

### Found: a tier set that is not a ladder

`tesamorelin`'s low/med/high are the labelled daily doses of EGRIFTA WR
(1.28 mg), EGRIFTA SV (1.4 mg) and the original EGRIFTA (2 mg), which give
similar systemic exposure. The record said so in `inst`; the cards above it said
CONSERVATIVE / *Best for first-time users* through ADVANCED / *For experienced
users*. Now flagged `tiersAreVariants` with per-tier `tierLabels` and a
`tierNote`. It is the only such record in the catalogue, and a test now fails if
another is added without the flag.

### Checked and clean

Schema and enum coverage on all 44 - no missing fields, no duplicate ids, no
unconvertible dose/vial unit pair, no non-ascending tier, no unsorted or
mismatched vial catalogue, no record whose own default recon volume the dropdown
cannot select. No computed zero and no dose overflowing a 100u barrel at any
record's defaults. Prose fields carry no placeholders, no mojibake, no empty
lists. Every record has a generated page.

The eight `approved` records were re-checked against the openFDA label data in
`.fda/`. `labelSizes`, `labelSource` and `doseAnchor` all hold up, including the
two that look wrong and are not: `pt141` is `approved` with vendor-only vial
sizes because Vyleesi is an autoinjector and no approved product is supplied as
a vial, and `hgh`/`hcg`/`epo`/`hmg` carry `doseAnchor: protocol` because the
molecule is approved while the dose shown is not.

### Open, and not a defect

`nadplus` and `glutathione` default to 500 and 600 mg/ml respectively - above
the ~400 mg/ml where lyophilised powder generally stops dissolving. Both are
genuinely dosed in hundreds of milligrams, so the doses are right; whether the
water volume is achievable is a question for the vendor's own reconstitution
note, and not something to change on a guess. Reported as a NOTE, not an error.

**Now surfaced rather than only logged (2026-08-20).** It was an audit note a
visitor never saw: the calculator printed `500 mg/ml` and a tidy 50-unit draw
with nothing saying the solution may not exist. `solubilityCheck` in
`calculator.js` flags any mg-scale vial x water combination above the ceiling,
in the app and in the reconstitution table on the peptide pages, and names the
water volume that clears it. Nine combinations across these two
records are affected; nothing else in the catalogue comes near.

**The open decision, sharpened.** The flagged row is not an edge case a visitor
has to go looking for - it is each record's *default*. `defaultReconMl` is 1 ml
for both, so the answer card, the `<meta name="description">` and the FAQ
JSON-LD served to search engines are all built on the concentration the page now
flags. For `nadplus` that headline reads *"250 mg is 50 units, when a 500 mg
vial is mixed with 1 ml"*.

Moving the defaults to 2 ml would change no dose, no vial size and no evidence
claim - only the water, and therefore the printed draw (`nadplus` 50 -> 100
units, `glutathione` 33.3 -> 66.7). It is left alone deliberately: the 400 mg/ml
figure is a general handling ceiling, not a measurement of these two compounds,
and a default is a number someone will follow. Changing it on a heuristic is the
same mistake as publishing one. **Jo's call**, and the one question that settles
it is what AminoUSA's own reconstitution note says for these two.

The vial-count warnings that remain (`aod9604` 26, `ara290` 34, `hgh` 34,
`nadplus` 42, `cjc1295_nodac` 17-51) are consequences of a long cycle at a high
cadence rather than arithmetic faults. Worth a second look if a larger vial size
exists; none is wrong.
