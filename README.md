# OddUnit QR+AR

Permanent QR codes, Web AR logo experiences, analytics, and Stripe Checkout for `qr.oddunit.be`.

## Stack

- Next.js on Cloudflare Workers via OpenNext
- Next.js Route Handlers for `/q/[slug]` redirects and admin API
- Cloudflare KV for permanent QR link configuration
- Three.js/jsQR for camera-based QR marker AR
- Stripe Checkout Sessions for subscription checkout

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

Production builds use `next build --webpack`. Next.js 16 defaults to Turbopack, but this project uses Webpack for the Cloudflare Worker build because it avoids an OpenNext runtime issue where App Router pages can fail with `components.ComponentMod.handler is not a function`.

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
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

For Cloudflare Workers, set secrets with:

```bash
npx wrangler secret put QR_ADMIN_TOKEN
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

`STRIPE_SECRET_KEY` is the only required Stripe value for hosted Checkout to work. The webhook secret is ready for later provisioning automation.

The browser admin UI sends `QR_ADMIN_TOKEN` to the route handler API. For production, put `/admin` behind Cloudflare Access as well.

## Routes

- `/`: customer-facing product site
- `/checkout/?plan=studio`: hosted checkout start page
- `/api/checkout`: creates a Stripe Checkout Session
- `/admin/`: create and edit QR links
- `/q/[slug]`: permanent QR URL
- `/x/[slug]/`: AR/3D experience page
- `/editor/`: SVG to 3D logo editor

After deployment, open `/admin/`, enter `QR_ADMIN_TOKEN`, and save the prefilled `oddunit-card` AR record once. Then this QR URL works:

```text
https://qr.oddunit.be/q/oddunit-card
```

You can also seed that first record directly from the repo:

```bash
npx wrangler kv key put qr:oddunit-card --path seeds/oddunit-card.json --binding QR_LINKS --preview false --remote
```

## Analytics

First-party analytics are stored in the same KV namespace:

- `qr_scan` when `/q/[slug]` is scanned
- `ar_open` when the AR experience loads
- `marker_lock` when the QR marker is detected in camera AR
- `cta_click` when the visitor clicks through

The admin dashboard shows totals and recent activity per QR code.

## QR marker tracking

The AR camera continuously decodes QR corners in a Web Worker. The most recent
QR region is scanned first, with a full-frame fallback. Only one frame is in
flight; video-frame callbacks avoid decoding the same camera frame twice.

The logo's base is mapped to all four measured QR corners, including perspective,
rotation and the camera's `object-fit: cover` crop. Adaptive filtering reduces
subpixel jitter; latency prediction is capped at 32 ms. A missing marker expires
after 150 ms. A different QR clears the anchor immediately, and re-acquisition
starts from the newly measured position. QR slugs and experience slugs may differ.

Both placement modes follow the marker. The legacy `vertical-spin` value now
means “Op QR plaatsen”; the logo has no independent rotation in AR. Preview
rotation remains available in the editor. `horizontal-rise` grows the model's
depth out of the QR plane on acquisition and respects reduced-motion preferences.
The base plane is projectively aligned; depth uses an estimated lens field of
view, so physical camera testing still matters, especially at steep angles.

Verification (Node.js 22.18+ or 24):

```bash
npm test
npm run lint
npm run build
```

With `npm run dev`, open `/dev/tracking` for a synthetic camera using the actual
video, worker and WebGL pipeline. Its controls exercise translation, perspective,
rotation, distance, marker loss and wrong-code rejection without camera permission.
This route returns 404 in production. Before release, also test a printed QR in
iOS Safari and Android Chrome: slow/fast movement, tilt, portrait/landscape,
temporary occlusion, camera refusal/retry and leaving/returning to the page.

## Search visibility

`/sitemap.xml` contains the public homepage and editor. Update its modification
dates when those pages materially change. `/robots.txt` advertises the sitemap;
admin, checkout and camera experiences use `noindex` metadata. Canonical URLs use
`NEXT_PUBLIC_SITE_URL`. The homepage exposes matching WebApplication structured
data for search engines and answer engines, without invented ratings or claims.
