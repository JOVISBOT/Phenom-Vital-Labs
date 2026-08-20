# Phenom Vital Labs - Peptide Dosage Calculator

Static, dependency-free calculator that turns a peptide, a vial size and a volume of
bacteriostatic water into the exact number of units to draw on an insulin syringe -
and shows the arithmetic that got there.

**Live:** https://jovisbot.github.io/Phenom-Vital-Labs/

## Running it

No build step, no package installs. It is plain ES modules, so it needs to be served
over HTTP rather than opened as a `file://` URL:

```bash
python -m http.server 8765
# http://127.0.0.1:8765/
```

## Tests

```bash
npm test                   # 58 tests, no dependencies
```

`test/calculator.test.mjs` holds the schema invariants, the dose-model rules and a
golden snapshot of all 44 peptides x 3 tiers. After an intentional change to the
maths or the data, refresh the snapshot and read the diff before committing it:

```bash
node test/calculator.test.mjs --update
git diff test/golden.json
```

`test/pages.test.mjs` covers the generated reference pages, the analytics layer and
the email gate. Its first assertion is a freshness gate: the 45 committed HTML files
are output, not a second copy of the truth, so editing a dose without rebuilding fails
the build instead of shipping a page that shows the old number authoritatively.

To check the rendered page rather than the numbers:

```bash
python tools/drive-ui.py            # the calculator
python tools/drive-pages.py         # the reference pages, mobile, and the email gate
```

## Reference pages

Every peptide has a static page at `/p/<id>/`, with a directory at `/p/`. They exist so
a search engine has 45 things to index instead of one, and so a peptide can be linked
to directly. Their dose figures, reconstitution tables and FAQ answers are rendered
from `data/peptides.json` through `js/calculator.js` at build time:

```bash
npm run build:pages     # writes p/**, regenerates sitemap.xml
npm run check:pages     # exits non-zero if anything is out of date
```

Never hand-edit anything under `p/` - it is generated, and the next build overwrites it.

## Growth features

Analytics, email capture on the PDF export and the custom-domain switch all ship
disabled and turn on with one edit each to `js/config.js`. See **[GROWTH.md](GROWTH.md)**.

Nothing is sent anywhere and no visitor is asked for an address until a real account id
is pasted in. Body weight, age and email addresses are never passed to analytics, and a
test enforces it.

## How a dose is calculated

```
concentration = vialSize / reconMl                  e.g. 10 mg / 3 ml = 3.33 mg/ml
volume        = dose / concentration                     0.4 mg / 3.33 = 0.12 ml
units         = volume x 100                             0.12 ml x 100 = 12 units
```

Two rules do most of the work:

- **An insulin syringe is U-100 - 100 units per millilitre.** Barrel size (30U, 50U,
  100U) caps how much you can draw in one pull; it does not change the reading.
- **Doses are flat protocol totals, not per kilogram.** Almost nothing in this class is
  dosed per kg. A peptide whose figures genuinely are per-kilogram opts in with
  `perKg: true` and is then multiplied by body weight.

## Data model

`data/peptides.json` (`schemaVersion: 2`). Per peptide:

| Field | Meaning |
|---|---|
| `doseUnit` | `mcg` \| `mg` \| `IU` - unit of `low`/`med`/`high` |
| `low`/`med`/`high` | Conservative / recommended / advanced dose |
| `perKg` | Optional. When true, the figures above are per kilogram |
| `vialUnit` | `mg` \| `IU` - unit of `vialSize` and `vialSizes` |
| `vialSize` | Default vial |
| `vialSizes` | Vials offered in the dropdown |
| `reconMl` | Default bacteriostatic water, chosen to land the recommended dose near 30 units |
| `components` | Blends only: per-component content, so per-peptide doses can be shown |
| `f` / `wks` | Doses per week / cycle length, used for the vial count |

`doseUnit: 'IU'` requires `vialUnit: 'IU'` and vice versa - the test enforces it.

## Layout

```
index.html            single page
404.html              self-contained (styles inlined; GitHub Pages serves it at any depth)
css/styles.css
js/
  main.js             entry point, URL state, event wiring
  calculator.js       pure maths, no DOM
  ui.js               rendering
  dataLoader.js       fetch + cache peptides.json
  pdfGenerator.js     one-page protocol sheet via jsPDF
  config.js           the only file to edit to enable analytics / email capture
  analytics.js        provider-agnostic, cookie-free event layer
  emailCapture.js     the PDF email gate
p/                    GENERATED - one page per peptide + directory
data/peptides.json    44 peptides
test/                 node --test suite + golden snapshot
tools/                one-shot data migrations and the browser driver
```

`tools/migrate-units.js` and `tools/set-recon-defaults.js` are the provenance for the
schema v2 data: each carries the evidence for every value it changed. They are
idempotent only against the pre-migration file - restore `data/peptides.json` from git
before re-running them.

## Cache busting

`index.html` and `dataLoader.js` carry matching `?v=` tokens. Bump them together
(`css/styles.css?v=`, `css/pages.css?v=`, `js/main.js?v=`, `ASSET_V` in
`tools/build-pages.js`, `DATA_VERSION` in `dataLoader.js`) when shipping a change, or
browsers will serve a new script against old data.

## Not medical advice

Reference calculations for research compounds. Most are not approved for human use and
the dosing conventions come from community practice, not controlled trials.
