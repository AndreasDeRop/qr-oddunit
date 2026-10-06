import Link from "next/link";
import { CheckCircle2, QrCode, WandSparkles } from "lucide-react";

type SuccessPageProps = {
  searchParams: Promise<{
    session_id?: string;
  }>;
};

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams;

  return (
    <main className="shell checkout-shell">
      <header className="topbar">
        <Link className="brand brand-full" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logos/logo-black-studio.svg" alt="OddUnit Studio" />
          <span>QR+AR</span>
        </Link>
        <nav className="nav">
          <Link href="/editor/">Editor</Link>
          <Link className="nav-cta" href="/admin/">Dashboard</Link>
        </nav>
      </header>

      <section className="final-cta success-cta">
        <CheckCircle2 size={28} />
        <h1>Je bestelling is ontvangen.</h1>
        <p>
          Je QR+AR ruimte is klaar voor activatie. Maak nu je 3D logo of open het dashboard om je QR-code te beheren.
        </p>
        {params.session_id ? <code>{params.session_id}</code> : null}
        <div className="button-row">
          <Link className="button primary" href="/editor/">
            <WandSparkles size={18} />
            3D logo maken
          </Link>
          <Link className="button ghost" href="/admin/">
            <QrCode size={18} />
            QR beheren
          </Link>
        </div>
      </section>
    </main>
  );
}
