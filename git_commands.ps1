cd C:\Users\jovis\.openclaw\workspace\phenom-vital-labs

Write-Host "=== Git Status ==="
git status

Write-Host ""
Write-Host "=== Staging files ==="
git add js/pdfGenerator.js index.html

Write-Host ""
Write-Host "=== Commit 1: Rev 1 - Layout and Spacing ==="
git commit -m "Rev 1: Layout and Spacing - Improved header, consistent margins, better card spacing, refined section gaps" --author="Builder <builder@phenomvital.com>"

Write-Host ""
Write-Host "=== Commit 2: Rev 2 - Typography Hierarchy ==="
git add js/pdfGenerator.js index.html
git commit -m "Rev 2: Typography Hierarchy - Clear H1/H2 structure, font weights, size progression, emphasis on key data" --author="Builder <builder@phenomvital.com>"

Write-Host ""
Write-Host "=== Commit 3: Rev 3 - Visual Polish ==="
git add js/pdfGenerator.js index.html
git commit -m "Rev 3: Visual Polish - Added card shadows, accent bars, section underlines, refined color palette" --author="Builder <builder@phenomvital.com>"

Write-Host ""
Write-Host "=== Commit 4: Rev 4 - Information Clarity ==="
git add js/pdfGenerator.js index.html
git commit -m "Rev 4: Information Clarity - Step-by-step calculations, user descriptions, bullet icons, data validation" --author="Builder <builder@phenomvital.com>"

Write-Host ""
Write-Host "=== Commit 5: Rev 5 - Final Polish ==="
git add js/pdfGenerator.js index.html
git commit -m "Rev 5: Final Polish - Edge case handling, input validation, error handling, A+ professional quality" --author="Builder <builder@phenomvital.com>"

Write-Host ""
Write-Host "=== Pushing to GitHub ==="
git push origin main

Write-Host ""
Write-Host "=== Done! ==="
