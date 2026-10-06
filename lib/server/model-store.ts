import { getRuntimeEnv } from "./env";

const MODEL_KEY_PREFIX = "model:";
const maxModelBytes = 20 * 1024 * 1024;

type LocalGlobal = typeof globalThis & {
  __oddunitQrModelStore?: Map<string, string>;
};

function modelKey(id: string) {
  return `${MODEL_KEY_PREFIX}${id}`;
}

function localStore() {
  const target = globalThis as LocalGlobal;

  if (!target.__oddunitQrModelStore) {
    target.__oddunitQrModelStore = new Map();
  }

  return target.__oddunitQrModelStore;
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

export function assertValidGltf(value: string) {
  const bytes = new TextEncoder().encode(value).byteLength;

  if (bytes > maxModelBytes) {
    throw new Error("GLTF is te groot om in KV op te slaan.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("GLTF moet geldige JSON zijn.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("asset" in parsed) ||
    typeof (parsed as { asset?: { version?: unknown } }).asset?.version !== "string"
  ) {
    throw new Error("GLTF mist een geldige asset header.");
  }

  return bytes;
}

export async function saveGeneratedModel(id: string, gltf: string, sourceName: string) {
  const bytes = assertValidGltf(gltf);
  const namespace = kvNamespace();

  if (!namespace) {
    localStore().set(id, gltf);
    return { id, bytes };
  }

  await namespace.put(modelKey(id), gltf, {
    metadata: {
      source_name: sourceName,
      bytes,
      content_type: "model/gltf+json",
      created_at: new Date().toISOString()
    }
  });

  return { id, bytes };
}

export async function getGeneratedModel(id: string) {
  const namespace = kvNamespace();

  if (!namespace) {
    return localStore().get(id) || null;
  }

  return namespace.get(modelKey(id));
}
