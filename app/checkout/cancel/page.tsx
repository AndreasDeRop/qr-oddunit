import Link from "next/link";
import { ArrowLeft, CreditCard, WandSparkles } from "lucide-react";
import { getCheckoutPlan } from "@/lib/plans";

type CancelPageProps = {
  searchParams: Promise<{
    plan?: string;
    reason?: string;
  }>;
};

export default async function CheckoutCancelPage({ searchParams }: CancelPageProps) {
  const params = await searchParams;
  const plan = getCheckoutPlan(params.plan);
  const stripeMissing = params.reason === "stripe";

  return (
    <main className="shell checkout-shell">
      <header className="topbar">
        <Link className="brand brand-full" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logos/logo-black-studio.svg" alt="OddUnit Studio" />
          <span>QR+AR</span>
        </Link>
        <nav className="nav">
          <Link href="/">
            <ArrowLeft size={17} />
            Home
          </Link>
        </nav>
      </header>

      <section className="final-cta success-cta">
        <CreditCard size={28} />
        <h1>{stripeMissing ? "Online betaling is bijna klaar." : "Je betaling is niet afgerond."}</h1>
        <p>
          {stripeMissing
            ? "Stripe moet nog geactiveerd worden met de geheime API key. Daarna start deze knop automatisch de checkout."
            : "Je kan opnieuw proberen, een ander pakket kiezen of eerst je 3D logo maken."}
        </p>
        <div className="button-row">
          <Link className="button primary" href={`/checkout/?plan=${plan.id}`}>
            <CreditCard size={18} />
            Opnieuw proberen
          </Link>
          <Link className="button ghost" href="/editor/">
            <WandSparkles size={18} />
            Eerst logo maken
          </Link>
        </div>
      </section>
    </main>
  );
}
