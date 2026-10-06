import Link from "next/link";
import { ArrowLeft, CheckCircle2, CreditCard, FileUp, QrCode, ShieldCheck, WandSparkles } from "lucide-react";
import { formatEuroCents, getCheckoutPlan } from "@/lib/plans";

type CheckoutPageProps = {
  searchParams: Promise<{
    plan?: string;
  }>;
};

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  const plan = getCheckoutPlan(params.plan);

  return (
    <main className="shell checkout-shell">
      <header className="topbar">
        <Link className="brand brand-full" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logos/logo-black-studio.svg" alt="OddUnit Studio" />
          <span>QR+AR checkout</span>
        </Link>
        <nav className="nav">
          <Link href="/">
            <ArrowLeft size={17} />
            Terug
          </Link>
          <Link href="/editor/">Editor</Link>
        </nav>
      </header>

      <section className="checkout-grid">
        <div className="checkout-copy">
          <p className="eyebrow">Bestellen</p>
          <h1>Start met {plan.name}.</h1>
          <p>
            Rond je bestelling af, maak je 3D logo in de editor en gebruik je vaste QR-code op je drukwerk.
            Je QR blijft aanpasbaar, zodat je later de bestemming of AR ervaring kan wijzigen.
          </p>

          <div className="order-steps">
            <div>
              <CreditCard size={20} />
              <strong>1. Kies en betaal</strong>
              <span>Start met je gekozen pakket en activeer je QR+AR ruimte.</span>
            </div>
            <div>
              <FileUp size={20} />
              <strong>2. Upload je logo</strong>
              <span>Maak een dik 3D logo met kleur, materiaal, spin en AR-positie.</span>
            </div>
            <div>
              <QrCode size={20} />
              <strong>3. Download je QR</strong>
              <span>Plaats je QR op visitekaartjes, stickers, posters of verpakking.</span>
            </div>
          </div>
        </div>

        <aside className="checkout-card">
          <div>
            <p className="route-label">Gekozen pakket</p>
            <h2>{plan.name}</h2>
            <div className="price-line">
              <strong>{formatEuroCents(plan.monthlyAmount)}</strong>
              <span>/maand</span>
            </div>
            <p>Eenmalige setup vanaf {formatEuroCents(plan.setupAmount)}</p>
          </div>

          <ul>
            {plan.features.map((feature) => (
              <li key={feature}>
                <CheckCircle2 size={16} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <form className="checkout-form" action="/api/checkout" method="post">
            <input name="plan" type="hidden" value={plan.id} />
            <button className="button primary" type="submit">
              <CreditCard size={18} />
              Bestelling afronden
            </button>
          </form>
          <Link className="button ghost" href="/editor/">
            <WandSparkles size={18} />
            Eerst 3D logo maken
          </Link>

          <p className="checkout-note">
            Na betaling of activatie kan je je QR-code gebruiken in drukwerk en je AR ervaring blijven aanpassen.
          </p>
        </aside>
      </section>

      <section className="final-cta compact-cta">
        <ShieldCheck size={24} />
        <h2>Je QR-code blijft permanent.</h2>
        <p>Je kan later de bestemming, CTA en AR ervaring wijzigen zonder nieuw drukwerk.</p>
      </section>
    </main>
  );
}
