import { error, isAssetUrl, isHttpUrl, isValidSlug, json, readJson, requireAdmin } from "@/lib/server/http";
import { getQrLink, saveQrLink } from "@/lib/server/qr-store";
import type { ArPlacement, QrKind, QrLink, QrStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type UpdatePayload = {
  title?: string;
  kind?: QrKind;
  destinationUrl?: string;
  destination_url?: string;
  experienceSlug?: string;
  experience_slug?: string;
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
  status?: QrStatus;
};

const validKinds = new Set<QrKind>(["redirect", "ar", "vcard"]);
const validStatuses = new Set<QrStatus>(["active", "paused", "archived"]);
const validArPlacements = new Set<ArPlacement>(["vertical-spin", "horizontal-rise"]);

async function routeSlug(context: RouteContext) {
  return (await context.params).slug;
}

export async function GET(request: Request, context: RouteContext) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const slug = await routeSlug(context);
  if (!isValidSlug(slug)) {
    return error("Invalid slug.");
  }

  try {
    const item = await getQrLink(slug);

    if (!item) {
      return error("QR code not found.", 404);
    }

    return json({ item });
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Unable to load QR code.", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const slug = await routeSlug(context);
  if (!isValidSlug(slug)) {
    return error("Invalid slug.");
  }

  try {
    const body = await readJson<UpdatePayload>(request);
    const current = await getQrLink(slug);

    if (!current) {
      return error("QR code not found.", 404);
    }

    const update: Partial<QrLink> = {};

    if (typeof body.title === "string") {
      update.title = body.title.trim();
    }

    if (typeof body.kind === "string" && validKinds.has(body.kind)) {
      update.kind = body.kind;
    }

    const destinationUrl = body.destinationUrl ?? body.destination_url;
    if (typeof destinationUrl === "string") {
      if (destinationUrl && !isHttpUrl(destinationUrl)) {
        return error("Destination must be a valid http or https URL.");
      }
      update.destination_url = destinationUrl || null;
    }

    const experienceSlug = body.experienceSlug ?? body.experience_slug;
    if (typeof experienceSlug === "string") {
      update.experience_slug = experienceSlug || null;
    }

    const modelUrl = body.modelUrl ?? body.model_url;
    if (typeof modelUrl === "string") {
      if (!isAssetUrl(modelUrl)) {
        return error("Model URL must be a relative path or http(s) URL.");
      }
      update.model_url = modelUrl || null;
    }

    const iosModelUrl = body.iosModelUrl ?? body.ios_model_url;
    if (typeof iosModelUrl === "string") {
      if (!isAssetUrl(iosModelUrl)) {
        return error("iOS model URL must be a relative path or http(s) URL.");
      }
      update.ios_model_url = iosModelUrl || null;
    }

    const ctaLabel = body.ctaLabel ?? body.primary_cta_label;
    if (typeof ctaLabel === "string") {
      update.primary_cta_label = ctaLabel || null;
    }

    const arPlacement = body.arPlacement ?? body.ar_placement;
    if (typeof arPlacement === "string" && validArPlacements.has(arPlacement)) {
      update.ar_placement = arPlacement;
    }

    const arSpinSpeed = body.arSpinSpeed ?? body.ar_spin_speed;
    if (typeof arSpinSpeed === "number" && Number.isFinite(arSpinSpeed)) {
      update.ar_spin_speed = Math.min(Math.max(arSpinSpeed, 0), 3);
    }

    const arScale = body.arScale ?? body.ar_scale;
    if (typeof arScale === "number" && Number.isFinite(arScale)) {
      update.ar_scale = Math.min(Math.max(arScale, 0.35), 2.4);
    }

    if (typeof body.status === "string" && validStatuses.has(body.status)) {
      update.status = body.status;
    }

    if (!Object.keys(update).length) {
      return error("No supported fields to update.");
    }

    const item = await saveQrLink({
      ...current,
      ...update
    });

    return json({ item });
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Unable to update QR code.", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const slug = await routeSlug(context);
  if (!isValidSlug(slug)) {
    return error("Invalid slug.");
  }

  try {
    const current = await getQrLink(slug);

    if (!current) {
      return error("QR code not found.", 404);
    }

    const item = await saveQrLink({
      ...current,
      status: "archived"
    });

    return json({ item });
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Unable to archive QR code.", 500);
  }
}
