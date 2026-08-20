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

## STILL OPEN

**1. Vial-size catalogues remain unsourced.** They are now defaults rather than
constraints - the user can type any size - but the pre-filled list is still
convention for most research compounds. Worth a pass against a real price list.

**2. No dose here is validated for human use.** Unchanged, and now stated per
record rather than once at the bottom of the page. The `trial` anchors
(cagrilintide, retatrutide, tirzepatide, dulaglutide) are trial arms and label
strengths from supervised settings, not self-administration guidance. BPC-157 and
TB-500 have no human dosing study at all, and the FDA compounding advisory
committee voted 11-3 against adding either to the 503A bulks list in July 2026.
