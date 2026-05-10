import { getRuntimeEnv } from "./env";

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

export function error(message: string, status = 400) {
  return json({ error: message }, status);
}

export async function readJson<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

export function requireAdmin(request: Request) {
  const env = getRuntimeEnv();
  const token = request.headers.get("x-admin-token") || new URL(request.url).searchParams.get("token");

  if (!env.QR_ADMIN_TOKEN) {
    return error("QR_ADMIN_TOKEN is not configured.", 500);
  }

  if (!token || token !== env.QR_ADMIN_TOKEN) {
    return error("Unauthorized.", 401);
  }

  return null;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function isValidSlug(value: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(value);
}

export function isHttpUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isAssetUrl(value: string | null | undefined) {
  if (!value) {
    return true;
  }

  return value.startsWith("/") || isHttpUrl(value);
}
