import Link from "next/link";
import { ArrowRight, Box, Cloud, Gauge, QrCode } from "lucide-react";

const demoQrUrl = "/q/oddunit-card";

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">OU</span>
          <span>qr.oddunit.be</span>
        </Link>
        <nav className="nav">
          <Link href="/admin/">Admin</Link>
          <Link href="/x/oddunit-card/">AR demo</Link>
        </nav>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">OddUnit QR control room</p>
          <h1>Permanente QR-codes met redirects, KV en web AR.</h1>
          <p>
            Elke code blijft naar een vaste OddUnit URL wijzen. De bestemming
            en ervaring kan je later aanpassen in Cloudflare KV zonder drukwerk te
            vervangen.
          </p>
          <div className="button-row">
            <Link className="button primary" href="/admin/">
              <QrCode size={18} />
              Admin openen
            </Link>
            <Link className="button ghost" href="/x/oddunit-card/">
              <Box size={18} />
              AR demo
            </Link>
          </div>
        </div>

        <div className="route-panel">
          <div className="route-label">Business card route</div>
          <code>{demoQrUrl}</code>
          <ArrowRight size={18} />
          <code>/x/oddunit-card</code>
          <Link className="button compact" href={demoQrUrl}>
            Test route
          </Link>
        </div>
      </section>

      <section className="metric-strip" aria-label="Project onderdelen">
        <div>
          <QrCode size={22} />
          <strong>Permanent</strong>
          <span>/q/[slug] blijft stabiel</span>
        </div>
        <div>
          <Gauge size={22} />
          <strong>Analytics later</strong>
          <span>D1 of Cloudflare Analytics</span>
        </div>
        <div>
          <Box size={22} />
          <strong>AR ready</strong>
          <span>GLB en optioneel USDZ</span>
        </div>
        <div>
          <Cloud size={22} />
          <strong>Cloudflare only</strong>
          <span>Geen slapende database</span>
        </div>
      </section>
    </main>
  );
}
