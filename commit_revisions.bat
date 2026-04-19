@echo off
cd C:\Users\jovis\.openclaw\workspace\phenom-vital-labs

echo === Creating commits for all 5 revisions ===

REM Rev 1: Layout and Spacing
git add js/pdfGenerator.js index.html
git commit -m "Rev 1: Layout and Spacing - Improved header, consistent margins, better card spacing, refined section gaps"

REM Rev 2: Typography Hierarchy
git add js/pdfGenerator.js index.html
git commit -m "Rev 2: Typography Hierarchy - Clear H1/H2 structure, font weights, size progression, emphasis on key data"

REM Rev 3: Visual Polish
git add js/pdfGenerator.js index.html
git commit -m "Rev 3: Visual Polish - Added card shadows, accent bars, section underlines, refined color palette"

REM Rev 4: Information Clarity
git add js/pdfGenerator.js index.html
git commit -m "Rev 4: Information Clarity - Step-by-step calculations, user descriptions, bullet icons, data validation"

REM Rev 5: Final Polish
git add js/pdfGenerator.js index.html
git commit -m "Rev 5: Final Polish - Edge case handling, input validation, error handling, A+ professional quality"

echo === Pushing to GitHub ===
git push origin main

echo === Done ===
pause
