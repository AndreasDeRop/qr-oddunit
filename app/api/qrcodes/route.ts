import { error, isAssetUrl, isHttpUrl, isValidSlug, json, readJson, requireAdmin, slugify } from "@/lib/server/http";
import { getAnalyticsForSlugs } from "@/lib/server/analytics-store";
import { createQrLink, getQrLink, listQrLinks, saveQrLink } from "@/lib/server/qr-store";
import type { ArPlacement, QrKind } from "@/lib/types";

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
  arPlacement?: ArPlacement;
  ar_placement?: ArPlacement;
  arSpinSpeed?: number;
  ar_spin_speed?: number;
  arScale?: number;
  ar_scale?: number;
};

const validKinds = new Set<QrKind>(["redirect", "ar", "vcard"]);
const validArPlacements = new Set<ArPlacement>(["vertical-spin", "horizontal-rise"]);

function spinSpeed(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(Math.max(numeric, 0), 3) : 0.9;
}

function arScale(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(Math.max(numeric, 0.35), 2.4) : 1;
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const rows = await listQrLinks();
    const analyticsBySlug = await getAnalyticsForSlugs(rows.map((item) => item.slug));
    const items = rows.map((item) => ({
      ...item,
      analytics: analyticsBySlug[item.slug]
    }));
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
    const kind = validKinds.has(body.kind as QrKind) ? (body.kind as QrKind) : "redirect";
    const title = (body.title || (kind === "ar" ? "AR Logo" : "QR Code")).trim();
    let slug = slugify(body.slug || `${title}-${crypto.randomUUID().slice(0, 8)}`);
    const destinationUrl = (body.destinationUrl || body.destination_url || "").trim();
    const modelUrl = (body.modelUrl || body.model_url || "/models/logo-black-studio-super-thick.gltf").trim();
    const iosModelUrl = (body.iosModelUrl || body.ios_model_url || "").trim();
    const ctaLabel = (body.ctaLabel || body.primary_cta_label || "Open site").trim();
    const arPlacement = validArPlacements.has(body.arPlacement as ArPlacement)
      ? (body.arPlacement as ArPlacement)
      : validArPlacements.has(body.ar_placement as ArPlacement)
        ? (body.ar_placement as ArPlacement)
        : "vertical-spin";
    const arSpinSpeed = spinSpeed(body.arSpinSpeed ?? body.ar_spin_speed ?? 0.9);
    const arModelScale = arScale(body.arScale ?? body.ar_scale ?? 1);

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

    let existing = await getQrLink(slug);
    if (existing && !body.slug) {
      slug = slugify(`${slug}-${crypto.randomUUID().slice(0, 5)}`);
      existing = await getQrLink(slug);
    }

    if (existing) {
      return error("A QR code with this slug already exists.", 409);
    }

    const experienceSlug = slugify(body.experienceSlug || slug);

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
      ar_placement: kind === "ar" ? arPlacement : null,
      ar_spin_speed: kind === "ar" ? arSpinSpeed : null,
      ar_scale: kind === "ar" ? arModelScale : null,
      status: "active"
    });

    const item = await saveQrLink(payload);

    return json({ item }, 201);
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Unable to create QR code.", 500);
  }
}
