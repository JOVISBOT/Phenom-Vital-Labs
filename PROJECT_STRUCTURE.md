# Project structure

Static site. No build step, no runtime dependencies. jsPDF is the only third-party
script and it is loaded from a CDN with an SRI hash.

```
index.html              Single page. Meta/OG tags, the config form, the disclaimer.
404.html                Styles inlined - GitHub Pages serves this at arbitrary depth,
                        where a relative stylesheet href would resolve wrongly.
manifest.json           PWA manifest (installable, no service worker).
favicon.svg             Icon.
og-image.png            1200x630 social card, rendered from og-image.svg.
og-image.svg            Source for the card above.
robots.txt              Allow-all + sitemap pointer.
sitemap.xml             47 URLs - the calculator, the planner, the directory, 44 records.

plan/
  index.html            Mix & cycle planner. Hand-written, not generated.

css/
  styles.css            All styles, including print rules (.animate-in starts at
                        opacity 0, so print needs an override or the page comes out blank).

js/
  main.js               Entry point. Event wiring, URL query-string state, PDF buttons.
  calculator.js         Pure functions. No DOM access, so it is directly testable in Node.
  ui.js                 All rendering and dropdown population. Owns the disclaimer text.
  dataLoader.js         Fetches and caches peptides.json. Holds DATA_VERSION.
  pdfGenerator.js       One-page A4 protocol sheet via jsPDF.
  plan.js               Planner page controller. DOM only - reads the form, calls
                        planner.js, writes the result.
  planner.js            Pure functions. Mix volume ranking, vial life, cycle supply,
                        and ISO date arithmetic anchored at noon UTC.
  planStore.js          Local persistence for the planner. Nothing leaves the browser.

data/
  peptides.json         44 peptides, schemaVersion 2.
  DATA-REVIEW.md        Open data questions deliberately left unchanged, and why.
  ENHANCEMENT_PLAN.md   Historical - the April vial-size pass. Now applied.
  PEPTIDE_VERIFICATION_NEEDED.md  Historical.

test/
  calculator.test.mjs   node --test. Schema invariants + dose model + golden snapshot.
  golden.json           All 44 peptides x 3 tiers. Regenerate with npm run test:update.
  planner.test.mjs      Date edges, the mix ranking's safety contract, the
                        empty-vs-expiry flip, and the planner's privacy boundary.

tools/
  migrate-units.js      One-shot: `fixed` boolean -> explicit doseUnit/vialUnit model,
                        plus the seven unit corrections. Carries its own evidence.
  set-recon-defaults.js One-shot: picks default vial size and reconstitution volume.
  drive-ui.py           Playwright driver. Screenshots + a DOM report of real output.
  drive-plan.py         Same, for the planner: 12 scenarios, save round trip, both
                        phone themes.
```

## Module dependency direction

```
main.js  ->  dataLoader.js
         ->  calculator.js     (pure)
         ->  ui.js             -> calculator.js
         ->  pdfGenerator.js   -> ui.js (disclaimer text + formatDose)

plan.js  ->  dataLoader.js
         ->  calculator.js     (pure)
         ->  planner.js        (pure) -> calculator.js
         ->  planStore.js      (localStorage only, no network)
```

`calculator.js` imports nothing. That is what lets the test suite run it under Node
with no DOM shim.
