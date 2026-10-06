import { getCloudflareContext } from "@opennextjs/cloudflare";

export type RuntimeEnv = {
  QR_ADMIN_TOKEN: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  QR_LINKS?: KVNamespace;
  hasCloudflareContext: boolean;
};

export function getRuntimeEnv(): RuntimeEnv {
  let cloudflareEnv: Partial<RuntimeEnv> = {};
  let hasCloudflareContext = false;

  try {
    cloudflareEnv = getCloudflareContext().env as Partial<RuntimeEnv>;
    hasCloudflareContext = true;
  } catch {
    cloudflareEnv = {};
  }

  return {
    QR_ADMIN_TOKEN: process.env.QR_ADMIN_TOKEN || cloudflareEnv.QR_ADMIN_TOKEN || "",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || cloudflareEnv.STRIPE_SECRET_KEY || "",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || cloudflareEnv.STRIPE_WEBHOOK_SECRET || "",
    QR_LINKS: cloudflareEnv.QR_LINKS,
    hasCloudflareContext
  };
}
