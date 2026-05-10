import { error, isAssetUrl, isHttpUrl, isValidSlug, json, readJson, requireAdmin, slugify } from "@/lib/server/http";
import { createQrLink, getQrLink, listQrLinks, saveQrLink } from "@/lib/server/qr-store";
import type { QrKind } from "@/lib/types";

export const dynamic = "force-dynamic";

type CreatePayload = {
  title?: string;
  slug?: string;
  kind?: QrKind;
  destinationUrl?: string;
  destination_url?: string;
  experienceSlug?: string;
  modelUrl?: string;
  model_url?: string;
  iosModelUrl?: string;
  ios_model_url?: string;
  ctaLabel?: string;
  primary_cta_label?: string;
};

const validKinds = new Set<QrKind>(["redirect", "ar", "vcard"]);

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const items = await listQrLinks();
    return json({ items });
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Unable to load QR codes.", 500);
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = await readJson<CreatePayload>(request);
    const title = (body.title || "").trim();
    const slug = slugify(body.slug || title);
    const kind = validKinds.has(body.kind as QrKind) ? (body.kind as QrKind) : "redirect";
    const destinationUrl = (body.destinationUrl || body.destination_url || "").trim();
    const experienceSlug = slugify(body.experienceSlug || slug);
    const modelUrl = (body.modelUrl || body.model_url || "/models/oddunit-logo.gltf").trim();
    const iosModelUrl = (body.iosModelUrl || body.ios_model_url || "").trim();
    const ctaLabel = (body.ctaLabel || body.primary_cta_label || "Open site").trim();

    if (!title) {
      return error("Title is required.");
    }

    if (!isValidSlug(slug)) {
      return error("Slug must use lowercase letters, numbers, and hyphens.");
    }

    if ((kind === "redirect" || kind === "ar") && !isHttpUrl(destinationUrl)) {
      return error("Destination must be a valid http or https URL.");
    }

    if (kind === "ar" && (!isAssetUrl(modelUrl) || !isAssetUrl(iosModelUrl))) {
      return error("Model URLs must be relative paths or http(s) URLs.");
    }

    const existing = await getQrLink(slug);
    if (existing) {
      return error("A QR code with this slug already exists.", 409);
    }

    const payload = createQrLink({
      title,
      slug,
      kind,
      destination_url: destinationUrl || null,
      experience_slug: kind === "ar" ? experienceSlug : null,
      model_url: kind === "ar" ? modelUrl : null,
      ios_model_url: kind === "ar" && iosModelUrl ? iosModelUrl : null,
      logo_url: null,
      primary_cta_label: ctaLabel || null,
      status: "active"
    });

    const item = await saveQrLink(payload);

    return json({ item }, 201);
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Unable to create QR code.", 500);
  }
}
