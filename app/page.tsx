import Link from "next/link";
import type { Metadata } from "next";
import {
  BarChart3,
  Box,
  Building2,
  CheckCircle2,
  Cloud,
  CreditCard,
  Package,
  QrCode,
  ShieldCheck,
  Sparkles,
  Store,
  Ticket,
  WandSparkles
} from "lucide-react";
import { checkoutPlans, formatEuroCents } from "@/lib/plans";
import { QrPreview } from "@/components/qr-preview";
import { siteDescription, siteUrl } from "@/lib/site";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const demoQrUrl = "/q/oddunit-card";

const useCases = [
  { icon: Building2, label: "Visitekaartjes", copy: "Laat je logo als 3D object boven je kaartje verschijnen." },
  { icon: Store, label: "Winkels en horeca", copy: "Maak menu's, displays en toonbankmateriaal interactief." },
  { icon: Ticket, label: "Events", copy: "Geef badges, posters en tickets een AR laag die blijft werken." },
  { icon: Package, label: "Verpakking", copy: "Voeg productuitleg, acties of 3D merkbeleving toe aan je doos of label." }
];

const workflow = [
  { icon: WandSparkles, label: "Upload je logo", copy: "Zet een SVG om naar een dik 3D model en kies kleur, dikte en rotatie." },
  { icon: QrCode, label: "Download je QR", copy: "Gebruik dezelfde QR-code op drukwerk, kaartjes, stickers of displays." },
  { icon: Box, label: "Scan in AR", copy: "Bezoekers openen de camera en zien je logo vast op de QR-marker." },
  { icon: BarChart3, label: "Bekijk resultaat", copy: "Volg scans, AR opens, marker locks en clicks in het dashboard." }
];

const pricing = Object.values(checkoutPlans);

const included = [
  ["Permanente QR-link", "Je drukwerk blijft bruikbaar, ook als de bestemming later verandert."],
  ["Web AR zonder app", "Scannen opent direct in de browser met camera en 3D model."],
  ["3D logo editor", "Pas dikte, kleur, materiaal, spin en AR-positie aan."],
  ["Analytics dashboard", "Meet scans, AR opens, marker locks en CTA clicks."]
];

export default function Home() {
  return (
    <main className="shell site-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "WebApplication", name: "OddUnit QR+AR",
        url: siteUrl, description: siteDescription, applicationCategory: "DesignApplication",
        operatingSystem: "Web browser", inLanguage: "nl-BE",
        publisher: { "@type": "Organization", name: "OddUnit Studio", url: "https://oddunit.be" }
      }).replace(/</g, "\\u003c") }} />
      <header className="topbar">
        <Link className="brand brand-full" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logos/logo-black-studio.svg" alt="OddUnit Studio" />
          <span>QR+AR</span>
        </Link>
        <nav className="nav">
          <Link href="#workflow">Zo werkt het</Link>
          <Link href="#pricing">Prijzen</Link>
          <Link href="/editor/">Editor</Link>
          <Link href={demoQrUrl}>Demo</Link>
          <Link className="nav-cta" href="#pricing">Start nu</Link>
        </nav>
      </header>

      <section className="hero-grid monetized-hero">
        <div className="hero-copy">
          <p className="eyebrow">QR-codes met echte Web AR</p>
          <h1>Laat je merk verschijnen wanneer iemand je QR-code scant.</h1>
          <p>
            Maak een permanente QR-code voor kaartjes, stickers, posters of verpakkingen.
            Na de scan ziet je bezoeker je 3D logo in AR en kan die meteen doorklikken naar je website.
          </p>
          <div className="button-row">
            <Link className="button primary" href="#pricing">
              <CreditCard size={18} />
              Kies je pakket
            </Link>
            <Link className="button ghost" href="/editor/">
              <WandSparkles size={18} />
              Maak 3D logo
            </Link>
            <Link className="button ghost" href="/x/oddunit-card/">
              <Box size={18} />
              Bekijk AR demo
            </Link>
          </div>
        </div>

        <div className="route-panel hero-product-panel">
          <div className="route-label">Live voorbeeld</div>
          <div className="hero-demo-qr">
            <QrPreview value={`${siteUrl}${demoQrUrl}`} size={240} />
            <p>Scan met je telefoon. Geef toegang tot je camera en richt opnieuw op deze QR-code.</p>
          </div>
          <p>
            De QR-code blijft dezelfde. Je past later de link, CTA en AR ervaring aan zonder nieuw drukwerk.
          </p>
          <Link className="button compact primary" href={demoQrUrl}>
            <QrCode size={17} />
            Open AR-demo
          </Link>
        </div>
      </section>

      <section className="metric-strip" aria-label="Wat je krijgt">
        <div>
          <QrCode size={22} />
          <strong>Permanent</strong>
          <span>1 QR voor print en updates</span>
        </div>
        <div>
          <Box size={22} />
          <strong>AR logo</strong>
          <span>3D model boven de QR-code</span>
        </div>
        <div>
          <BarChart3 size={22} />
          <strong>Analytics</strong>
          <span>Scans, AR opens en clicks</span>
        </div>
        <div>
          <Cloud size={22} />
          <strong>Hosting</strong>
          <span>Cloudflare hosting inbegrepen</span>
        </div>
      </section>

      <section className="product-section" id="workflow">
        <div className="section-heading">
          <p className="eyebrow">Zo werkt het</p>
          <h2>Van logo naar scanbare AR ervaring.</h2>
        </div>
        <div className="use-case-grid">
          {workflow.map((item) => {
            const Icon = item.icon;
            return (
              <article className="product-card" key={item.label}>
                <Icon size={24} />
                <strong>{item.label}</strong>
                <span>{item.copy}</span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="product-section" id="product">
        <div className="section-heading">
          <p className="eyebrow">Voor wie</p>
          <h2>Maak je drukwerk interactief.</h2>
        </div>
        <div className="use-case-grid">
          {useCases.map((item) => {
            const Icon = item.icon;
            return (
              <article className="product-card" key={item.label}>
                <Icon size={24} />
                <strong>{item.label}</strong>
                <span>{item.copy}</span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div className="section-heading">
          <p className="eyebrow">Pakketten</p>
          <h2>Kies hoe groot je AR QR campagne wordt.</h2>
          <p>
            Start klein met een kaartje of bouw meerdere ervaringen voor winkels, events en verpakkingen.
            Hosting, permanente QR-links en analytics zitten in elk pakket.
          </p>
        </div>

        <div className="pricing-grid">
          {pricing.map((plan) => (
            <article className={`pricing-card ${plan.id === "studio" ? "featured" : ""}`} key={plan.id}>
              <div>
                <p className="route-label">{plan.name}</p>
                <div className="price-line">
                  <strong>{formatEuroCents(plan.monthlyAmount)}</strong>
                  <span>/maand</span>
                </div>
                <p>Eenmalige setup vanaf {formatEuroCents(plan.setupAmount)}</p>
                <p>{plan.description}</p>
              </div>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Sparkles size={15} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link className={`button ${plan.id === "studio" ? "primary" : "ghost"}`} href={`/checkout/?plan=${plan.id}`}>
                <CreditCard size={17} />
                Bestel {plan.name}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="stack-section">
        <div className="section-heading">
          <p className="eyebrow">Inbegrepen</p>
          <h2>Alles om je QR-code echt te gebruiken.</h2>
        </div>
        <div className="stack-grid">
          {included.map(([title, copy]) => (
            <div key={title}>
              <CheckCircle2 size={20} />
              <strong>{title}</strong>
              <span>{copy}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <ShieldCheck size={24} />
        <h2>Klaar om je eerste AR QR-code te maken?</h2>
        <p>Kies een pakket, maak je 3D logo en gebruik je QR op kaartjes, stickers of drukwerk.</p>
        <Link className="button primary" href="#pricing">
          <CreditCard size={18} />
          Bekijk pakketten
        </Link>
      </section>
    </main>
  );
}
