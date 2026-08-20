# Peptide Data Enhancement Plan

**Status:** Ready to apply
**Date:** 2026-04-21
**Goal:** Add explicit vialSize field to all peptides without breaking existing functionality

## Analysis Summary

**Total Peptides:** ~40
**Already Have vialSize:** 3 (blend_heal: 10mg, blend_heal_20: 20mg, blend_gh1: implicit)
**Missing vialSize:** ~37 peptides

## Vial Size Determination from Instructions

| Peptide ID | Inferred Vial Size | Source Evidence |
|-----------|-------------------|-----------------|
| ace031 | 5mg | "Start low (0.5mg)" + weekly dosing |
| adamax | 5mg | "300mcg" daily + research dosing |
| adipotide | 5mg | "300mcg" daily injections |
| aicar | 50mg | "100-200mg" daily dosing |
| aod9604 | 5mg | "0.5mg" typical dosing |
| ara290 | 10mg | "2-4mg" higher doses |
| b733 | 5mg | "1-2mg" dosing |
| bpc157 | 5mg | "Reconstitute 5mg vial" explicit |
| cagrilintide | 5mg | Weekly dosing typical |
| cagrisema | 5mg | "2.5mg+2.5mg" blend |
| cjc1295 | 2mg | DAC version typically 2mg |
| cjc1295_nodac | 2mg | Mod GRF typically 2mg |
| cortagen | 10mg | "2-10mg" bioregulator doses |
| crystagen | 10mg | "2-10mg" bioregulator doses |
| dermorphin | 5mg | Research compound |
| dihexa | 10mg | "8-32mg" high doses |
| dsip | 5mg | "200mcg" sleep dosing |
| dulaglutide | 1.5mg | Pen device (0.75-4.5mg) |
| epo | 3000iu | "3x weekly" standard |
| follistatin | 1mg | "50-150mcg" dosing |
| foxo4 | 5mg | "1-5mg" senolytic |
| frag1723 | 5mg | Fragment dosing |
| ghrp2 | 5mg | "100-300mcg" GHRP |
| ghrp6 | 5mg | "100-300mcg" GHRP |
| glutathione | 200mg | "100-500mcg" but typically 200mg vials |

## Standard Vial Sizes by Category

**Healing Peptides:**
- BPC-157: 5mg
- TB-500: 5mg or 10mg
- Blend: 10mg or 20mg

**GH Secretagogues:**
- CJC-1295: 2mg (DAC or NO DAC)
- Ipamorelin: 5mg
- GHRP-2/6: 5mg
- Sermorelin: 5mg

**GLP-1/Weight Loss:**
- Semaglutide: 5mg or 10mg
- Tirzepatide: 5mg or 10mg
- Cagrilintide: 5mg
- AOD-9604: 5mg

**Nootropics:**
- Semax: 10mg
- Selank: 10mg
- Dihexa: 10mg
- Adamax: 5mg

**Bioregulators:**
- Cortagen: 10mg
- Crystagen: 10mg
- Other Khavinson: 10mg

## Enhancement Strategy

1. **Backup original** ✅ Already done
2. **Add vialSize field** to each peptide object
3. **Preserve ALL existing data** exactly as-is
4. **No dosing changes** (only adding metadata field)

## Changes Summary

| Action | Count |
|--------|-------|
| Add vialSize field | ~37 peptides |
| Modify existing data | 0 (preserved) |
| Risk level | LOW |

## Ready to Apply?

Confirm these vial sizes look correct before I generate the enhanced file:

- Standard peptides: **5mg** (most common)
- Healing blends: **10mg or 20mg** (already set)
- GH-related singles: **2mg or 5mg**
- Bioregulators: **10mg**
- High-dose metabolic: **5mg or 10mg**
- Research compounds: **5mg** (standard)

**Say "apply" to generate enhanced peptides.json with all vialSize fields added.**

**Or give me specific corrections:**
- "Change [peptide] to [size]mg"
- "Leave [peptide] as-is"
