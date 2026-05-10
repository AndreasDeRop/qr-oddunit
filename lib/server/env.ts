import { getCloudflareContext } from "@opennextjs/cloudflare";

export type RuntimeEnv = {
  QR_ADMIN_TOKEN: string;
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
    QR_LINKS: cloudflareEnv.QR_LINKS,
    hasCloudflareContext
  };
}
