import { json } from "@/lib/server/http";
import { getRuntimeEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";

function bufferToHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function signatureParts(header: string) {
  return Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
  );
}

async function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts = signatureParts(header);
  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    return false;
  }

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign"
  ]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = bufferToHex(digest);

  return expected.length === signature.length && expected === signature;
}

export async function POST(request: Request) {
  const env = getRuntimeEnv();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  if (env.STRIPE_WEBHOOK_SECRET) {
    const verified = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!verified) {
      return json({ error: "Invalid Stripe signature." }, 400);
    }
  }

  const event = JSON.parse(body) as { type?: string; data?: { object?: { id?: string; metadata?: Record<string, string> } } };

  console.info("Stripe webhook received", {
    type: event.type,
    objectId: event.data?.object?.id,
    plan: event.data?.object?.metadata?.plan
  });

  return json({ received: true });
}
