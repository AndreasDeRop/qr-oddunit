import { getRuntimeEnv } from "./env";
import type { QrLink } from "@/lib/types";

const QR_KEY_PREFIX = "qr:";

type LocalGlobal = typeof globalThis & {
  __oddunitQrLocalStore?: Map<string, QrLink>;
};

const localSeed: QrLink = {
  id: "local-oddunit-card",
  slug: "oddunit-card",
  title: "OddUnit business card",
  kind: "ar",
  destination_url: "https://oddunit.be",
  experience_slug: "oddunit-card",
  model_url: "/models/oddunit-logo.gltf",
  ios_model_url: null,
  logo_url: null,
  primary_cta_label: "Open oddunit.be",
  status: "active",
  scans_count: 0,
  last_scanned_at: null,
  created_at: new Date("2026-05-10T00:00:00.000Z").toISOString(),
  updated_at: new Date("2026-05-10T00:00:00.000Z").toISOString()
};

function qrKey(slug: string) {
  return `${QR_KEY_PREFIX}${slug}`;
}

function localStore() {
  const target = globalThis as LocalGlobal;

  if (!target.__oddunitQrLocalStore) {
    target.__oddunitQrLocalStore = new Map([[localSeed.slug, localSeed]]);
  }

  return target.__oddunitQrLocalStore;
}

function kvNamespace() {
  const env = getRuntimeEnv();

  if (env.QR_LINKS) {
    return env.QR_LINKS;
  }

  if (process.env.NODE_ENV === "development" || !env.hasCloudflareContext) {
    return null;
  }

  throw new Error("Cloudflare KV binding QR_LINKS is not configured.");
}

function withDevelopmentSeed(items: QrLink[]) {
  if (process.env.NODE_ENV === "development" && !items.some((item) => item.slug === localSeed.slug)) {
    return [...items, localSeed];
  }

  return items;
}

export function createQrLink(input: Omit<QrLink, "id" | "created_at" | "updated_at">): QrLink {
  const now = new Date().toISOString();

  return {
    ...input,
    id: crypto.randomUUID(),
    scans_count: 0,
    last_scanned_at: null,
    created_at: now,
    updated_at: now
  };
}

export async function listQrLinks() {
  const namespace = kvNamespace();

  if (!namespace) {
    return [...localStore().values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  const items: QrLink[] = [];
  let cursor: string | undefined;

  do {
    const page = await namespace.list({ prefix: QR_KEY_PREFIX, cursor });
    const values = await Promise.all(page.keys.map((key) => namespace.get(key.name)));

    for (const value of values) {
      if (value) {
        items.push(JSON.parse(value) as QrLink);
      }
    }

    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return withDevelopmentSeed(items).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getQrLink(slug: string) {
  const namespace = kvNamespace();

  if (!namespace) {
    return localStore().get(slug) || null;
  }

  const raw = await namespace.get(qrKey(slug));
  if (!raw && process.env.NODE_ENV === "development" && slug === localSeed.slug) {
    return localSeed;
  }

  return raw ? (JSON.parse(raw) as QrLink) : null;
}

export async function saveQrLink(link: QrLink) {
  const next = {
    ...link,
    updated_at: new Date().toISOString()
  };
  const namespace = kvNamespace();

  if (!namespace) {
    localStore().set(next.slug, next);
    return next;
  }

  await namespace.put(qrKey(next.slug), JSON.stringify(next), {
    metadata: {
      title: next.title,
      kind: next.kind,
      status: next.status,
      updated_at: next.updated_at
    }
  });

  return next;
}
