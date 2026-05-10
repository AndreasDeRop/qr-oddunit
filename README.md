# OddUnit QR

Permanent QR redirects and AR landing experiences for `qr.oddunit.be`.

## Stack

- Next.js on Cloudflare Workers via OpenNext
- Next.js Route Handlers for `/q/[slug]` redirects and admin API
- Cloudflare KV for permanent QR link configuration
- `<model-viewer>` for GLB/GLTF web 3D and optional USDZ iOS AR

## Local setup

```bash
npm install
npm run dev
```

`next dev` runs the normal Next.js development server. To preview the same runtime Cloudflare uses:

```bash
npm run preview
```

Copy `.dev.vars.example` to `.dev.vars` for Worker preview values. Use `.env.local` if you also want `next dev` to see the same values.

## Cloudflare KV

Create one KV namespace for QR records:

```bash
npx wrangler kv namespace create QR_LINKS
npx wrangler kv namespace create QR_LINKS --preview
```

Paste the returned namespace IDs into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "QR_LINKS"
id = "..."
preview_id = "..."
```

KV stores one JSON record per QR slug under keys like:

```text
qr:oddunit-card
```

`next dev` uses an in-memory local fallback seeded with `oddunit-card`. Production requires the real `QR_LINKS` KV binding.

## Cloudflare Workers

Deploy with:

```bash
npm run deploy
```

For CI or Workers Builds, use:

- Build command: `npm run deploy`
- Worker entry: `.open-next/worker.js`
- Static assets: `.open-next/assets`

Set these runtime variables/secrets in Cloudflare Workers:

```text
NEXT_PUBLIC_SITE_URL=https://qr.oddunit.be
QR_ADMIN_TOKEN=long-random-admin-token
```

The browser admin UI sends `QR_ADMIN_TOKEN` to the route handler API. For production, put `/admin` behind Cloudflare Access as well.

## Routes

- `/admin/`: create and edit QR links
- `/q/[slug]`: permanent QR URL
- `/x/[slug]/`: AR/3D experience page

After deployment, open `/admin/`, enter `QR_ADMIN_TOKEN`, and save the prefilled `oddunit-card` AR record once. Then this QR URL works:

```text
https://qr.oddunit.be/q/oddunit-card
```

## Analytics

This version does not write a scan row on every QR hit. That keeps the permanent QR layer cheap and robust in KV. Add Cloudflare D1 or Analytics Engine later when you want scan history, dashboards, country/device breakdowns, or campaign reporting.
