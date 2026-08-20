# Peptide Data Verification Report

**Generated:** 2026-04-21
**Purpose:** Cross-check current JSON data against NPT price list for accuracy

## Current Status

**File:** `peptides.json`
**Peptide Count:** ~40 peptides
**Last Updated:** 2026-04-19

## Issues Found

### 1. Missing vialSize Field
Many peptides lack explicit `vialSize` field - only inferred from instructions.

| Peptide ID | Current Vial Size | Source |
|-----------|-------------------|--------|
| ace031 | Not specified | "0.5mg" in instructions |
| adamax | Not specified | "300mcg" in instructions |
| adipotide | Not specified | "300mcg" in instructions |
| aicar | Not specified | "100-200mg" in instructions |
| aod9604 | Not specified | "0.5mg" in instructions |
| ara290 | Not specified | "2-4mg" in instructions |
| b733 | Not specified | "1-2mg" in instructions |
| blend_gh1 | 10mg | ✅ Has field |
| blend_heal | 10mg | ✅ Has field |
| blend_heal_20 | 20mg | ✅ Has field |

### 2. Dosing Verification Needed

**High-priority checks:**
- Semaglutide dosing (currently 500mcg med) - verify against clinical guidelines
- Tirzepatide dosing - verify against manufacturer specs
- BPC-157 dosing - widely varies by source
- TB-500 dosing - check standard protocols

### 3. Blend Ratios
- CJC1295 NO DAC + Ipamorelin blend - verify 5mg+5mg = 10mg total
- BPC + TB blends - verify 5mg+5mg and 10mg+10mg ratios

## Recommended Action

**Option A: Conservative (Safest)**
1. Create `peptides-backup.json` before any changes
2. Add vialSize field only where 100% certain
3. Flag questionable dosages for research verification

**Option B: Full Audit**
1. Export NPT price list to readable format
2. Cross-reference every peptide
3. Update with verified data only

## Questions for You

1. **What vial sizes does NPT list?** (2mg, 5mg, 10mg, 20mg?)
2. **Any peptides you know are WRONG in current data?**
3. **Priority:** Fix vial sizes first, or dosing amounts?

## Current Data Integrity

✅ **Structure:** Good (valid JSON)
✅ **Required fields:** All present
⚠️ **Optional fields:** vialSize missing on ~30 peptides
⚠️ **Verification:** Not cross-referenced with NPT list

**Recommendation:** Do NOT modify until we verify against NPT source.
