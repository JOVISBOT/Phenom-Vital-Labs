# Peptide data - open questions

Companion to the schema v2 migration (`tools/migrate-units.js`). Everything in that
script was changed because the record's own instruction text, or a universal dosing
convention, contradicted the stored value. **The items below were left alone** because
correcting them would mean picking a dose rather than fixing a unit, and that is a
content decision, not a bug fix.

Supersedes `ENHANCEMENT_PLAN.md` and `PEPTIDE_VERIFICATION_NEEDED.md`, which stalled in
April 2026 awaiting exactly this sign-off. The vial sizes they proposed have now been
applied.

---

## 1. Doses that look low against published protocols

| Peptide | Stored (low/med/high) | Published reference | Gap |
|---|---|---|---|
| `cagrilintide` | 100 / 200 / 400 mcg | Phase 2 titration 0.3 -> 4.5 mg weekly | recommended dose is ~12x below maintenance |
| `retatrutide` | 1 / 2 / 4 mg | Its own instructions say "Week 13+: 9-12mg weekly" | `high` is below the record's own therapeutic dose |

Both under-dose rather than over-dose, so neither is dangerous. But a calculator that
reports a number nobody uses is still wrong. **Decision needed: raise these to the
published ranges, or relabel the tiers as titration starting points.**

## 2. Instruction text that contradicts the dose fields

| Peptide | Dose field says | `inst` says |
|---|---|---|
| `blend_gh1` | med = 0.4 mg combined (200 mcg of each) | "Typical dose: 300mcg (0.3mg) of each peptide per injection" |
| `blend_heal` | med = 1.5 mg combined (750 mcg of each) | "Typical dose: 1mg total (500mcg of each peptide)" |
| `blend_heal_20` | med = 2 mg combined | "Typical dose: 1.5mg total (750mcg of each)" |
| `tb500` | med = 1500 mcg, 2x weekly (3 mg/wk) | "Maintenance: 5mg twice weekly" (10 mg/wk) |

The dose fields are the conservative reading in every case and the UI now shows the
per-component split, so the ambiguity is visible rather than hidden. Still worth
reconciling so the sheet does not argue with itself.

## 3. Cycle arithmetic that does not match the stated protocol

| Peptide | `f` x `wks` | `inst` says |
|---|---|---|
| `cortagen` | 1/wk x 3 wks = 3 doses | "20-day course twice yearly" |
| `crystagen` | 1/wk x 3 wks = 3 doses | "20-day course twice yearly" |
| `thymalin` | 7/wk x 2 wks = 14 doses | "10mg daily for 10 days" (close enough) |

`f` and `wks` drive the vial count, so cortagen and crystagen currently under-report
vials by roughly 6x.

## 4. Peptides with no vial-size evidence

`ENHANCEMENT_PLAN.md` derived vial sizes from instruction text but only got as far as
`glutathione` alphabetically. The remainder were assigned by dosing scale and
category convention:

`gonadorelin` 2mg, `hexarelin` 5mg, `hgh` 10 IU, `hmg` 150 IU, `melanotan2` 10mg,
`motsc` 10mg, `pegmgf` 2mg, `pt141` 10mg, `retatrutide` 10mg, `sermorelin` 5mg,
`tb500` 5mg, `tesamorelin` 5mg, `thymalin` 20mg, `tirzepatide` 10mg.

These change how far up the barrel you draw, not how much peptide you get - a wrong
vial size is a legibility problem, not a dosing one, as long as the user picks the
size actually printed on their vial from the dropdown. Worth checking against a real
supplier price list.

## 5. Marketing copy

The header previously read "99%+ Purity Verified" and the results block repeated it as
a badge next to the dose figures. The site sells nothing and tests nothing, so the
claim was unsourced. It now reads "Research use only". If a purity claim goes back,
it needs to point at actual certificates of analysis.
