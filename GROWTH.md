# Turning the growth features on

Three things shipped switched off, because each one needs an account that only the
site owner can create. Everything else about them is built, tested and live. Each is a
single edit to `js/config.js` — no build step, no rebuild of the pages, no code.

Until they are switched on:

- **analytics** sends nothing, loads no third-party script, and sets no cookie
- **email capture** never appears — no visitor is asked for an address, because there
  would be nowhere to put one

That is deliberate. A half-wired analytics call that silently fails is worse than no
analytics: it looks like measurement while measuring nothing.

---

## 1. Analytics — 5 minutes

Pick one. All four are cookie-free and need no EU consent banner, which is why Google
Analytics is not on the list; it would put a cookie banner in front of a calculator.

| Provider | Free tier | Custom events | Notes |
|---|---|---|---|
| **Cloudflare Web Analytics** | unlimited, free forever | ❌ page views only | zero cost, least data |
| **GoatCounter** | free for non-commercial | ✅ | simplest signup |
| **Umami Cloud** | free tier | ✅ | good dashboard |
| **Plausible** | paid after trial | ✅ | best of the four |

Custom events are what answer the interesting questions — *which peptide, which tier,
did anyone take the PDF*. Cloudflare cannot do them, so it will show traffic but not
behaviour.

Then edit `js/config.js`:

```js
analytics: {
    provider: 'goatcounter',   // or 'plausible' | 'cloudflare' | 'umami'
    site: 'phenomvital',       // goatcounter: the subdomain you registered
    domain: '',                // plausible: the domain you registered
    token: '',                 // cloudflare: beacon token. umami: website id
    host: '',                  // umami: script origin
    debug: false
}
```

Commit, push, done. To check it locally without sending anything anywhere, set
`debug: true` and watch the console — every event prints instead of sending.

### What gets recorded

| Event | Properties |
|---|---|
| `peptide_selected` | `peptide` |
| `calculate` | `peptide`, `category`, `reconMl`, `syringe`, `overflow` |
| `pdf_preview` / `pdf_download` | `peptide` |
| `copy_link` | `peptide` |
| `email_captured` / `email_declined` / `email_failed` | `source`, `via` |

**Body weight, age and email addresses are never sent.** They are health data about a
named person; the peptide id and the tier are catalogue facts. A test
(`no page leaks weight or age into a tracked event`) fails the build if that changes.

Do Not Track and Global Privacy Control are honoured — those visitors are not counted.

---

## 2. Email capture on the PDF — 5 minutes

The protocol sheet is the one thing on this site a visitor wants to keep, so it is the
only honest place to ask for an address: the ask is attached to something being given.

The quickest working option is **Formspree** (free tier: 50 submissions/month) — create
a form, copy its endpoint. Any endpoint that accepts a JSON `POST` works too; use
`provider: 'custom'`.

```js
emailCapture: {
    provider: 'formspree',
    endpoint: 'https://formspree.io/f/xxxxxxxx',
    mode: 'soft'
}
```

The POST body is:

```json
{ "email": "...", "source": "pdf", "peptide": "bpc157", "page": "/Phenom-Vital-Labs/" }
```

### soft vs hard

- **`soft` (recommended)** — the dialog has a *"No thanks, just download it"* link, and
  the download proceeds no matter what: declined, network failure, blocked endpoint.
  The tool stays a tool.
- **`hard`** — an address is required before the first download. Higher capture rate,
  and a proportion of visitors leave instead. On a reference calculator that people
  reach mid-task, `soft` is the right default.

Either way a visitor is asked **once**. The answer is remembered in `localStorage`;
completing or declining both stop the ask permanently.

The *preview* button is never gated — only the download.

---

## 3. A real domain — ~$12/year

`jovisbot.github.io/Phenom-Vital-Labs/` reads as a hobby project and puts every page two
path segments deep. A domain fixes both and takes about ten minutes:

1. Buy the domain (Cloudflare Registrar sells at cost).
2. Add a `CNAME` file at the repo root containing just the domain.
3. Point DNS at GitHub Pages: four `A` records to `185.199.108-111.153`, or a `CNAME`
   to `jovisbot.github.io`.
4. In the repo's Pages settings, set the custom domain and tick *Enforce HTTPS*.
5. Update `SITE.origin` and `SITE.basePath` in `js/config.js`, then
   `npm run build:pages` — every canonical, OG tag and sitemap entry follows
   automatically.

Step 5 is the reason the origin lives in config rather than being hard-coded in 45
files.

---

## What was already done, and needs nothing

- **45 indexable pages** — a directory at `/p/` plus one page per peptide, each with its
  own title, description, canonical, breadcrumb and FAQ structured data, generated from
  `data/peptides.json` by `npm run build:pages`.
- **The numbers on those pages come from `calculator.js` at build time.** They cannot
  drift from the app: `npm test` fails if the committed HTML no longer matches the data.
- **`sitemap.xml`** lists all 46 URLs and is regenerated by the same command.
