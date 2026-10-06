import { getCheckoutPlan } from "@/lib/plans";
import { getRuntimeEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";

function appendLineItem(
  params: URLSearchParams,
  index: number,
  item: {
    name: string;
    description: string;
    unitAmount: number;
    recurring?: boolean;
  }
) {
  params.append(`line_items[${index}][quantity]`, "1");
  params.append(`line_items[${index}][price_data][currency]`, "eur");
  params.append(`line_items[${index}][price_data][unit_amount]`, String(item.unitAmount));
  params.append(`line_items[${index}][price_data][product_data][name]`, item.name);
  params.append(`line_items[${index}][price_data][product_data][description]`, item.description);

  if (item.recurring) {
    params.append(`line_items[${index}][price_data][recurring][interval]`, "month");
  }
}

export async function POST(request: Request) {
  const env = getRuntimeEnv();
  const formData = await request.formData();
  const plan = getCheckoutPlan(String(formData.get("plan") || "studio"));
  const origin = new URL(request.url).origin;

  if (!env.STRIPE_SECRET_KEY) {
    return Response.redirect(new URL(`/checkout/cancel?plan=${plan.id}&reason=stripe`, origin), 303);
  }

  const params = new URLSearchParams();
  params.append("mode", "subscription");
  params.append("success_url", `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
  params.append("cancel_url", `${origin}/checkout?plan=${plan.id}`);
  params.append("billing_address_collection", "auto");
  params.append("allow_promotion_codes", "true");
  params.append("metadata[plan]", plan.id);
  params.append("subscription_data[metadata][plan]", plan.id);
  params.append("subscription_data[metadata][qr_limit]", String(plan.qrLimit));
  params.append("subscription_data[metadata][ar_limit]", String(plan.arLimit));
  appendLineItem(params, 0, {
    name: `OddUnit QR+AR ${plan.name}`,
    description: plan.description,
    unitAmount: plan.monthlyAmount,
    recurring: true
  });

  if (plan.setupAmount > 0) {
    appendLineItem(params, 1, {
      name: `Setup ${plan.name}`,
      description: "Eenmalige activatie, basisconfiguratie en eerste QR+AR setup.",
      unitAmount: plan.setupAmount
    });
  }

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  if (!stripeResponse.ok) {
    console.error(await stripeResponse.text());
    return Response.redirect(new URL(`/checkout/cancel?plan=${plan.id}&reason=stripe-error`, origin), 303);
  }

  const session = (await stripeResponse.json()) as { url?: string };

  if (!session.url) {
    return Response.redirect(new URL(`/checkout/cancel?plan=${plan.id}&reason=no-url`, origin), 303);
  }

  return Response.redirect(session.url, 303);
}
