import { error, isValidSlug, json } from "@/lib/server/http";
import { recordAnalyticsEvent } from "@/lib/server/analytics-store";
import { listQrLinks } from "@/lib/server/qr-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const slug = (await context.params).slug;

  if (!isValidSlug(slug)) {
    return error("Invalid slug.");
  }

  try {
    const rows = await listQrLinks();
    const row = rows.find(
      (item) => item.kind === "ar" && item.status === "active" && (item.slug === slug || item.experience_slug === slug)
    );

    if (!row) {
      return error("Experience not found.", 404);
    }

    await recordAnalyticsEvent(row.slug, "ar_open").catch((caught) => {
      console.error(caught);
    });

    return json(
      {
        slug: row.experience_slug || row.slug,
        qrSlugs: rows.filter((item) => item.kind === "ar" && item.status === "active" &&
          (item.slug === row.slug || (item.experience_slug || item.slug) === (row.experience_slug || row.slug)))
          .map((item) => item.slug),
        title: row.title,
        destinationUrl: row.destination_url || "https://oddunit.be",
        modelUrl: row.model_url || "/models/logo-black-studio-super-thick.gltf",
        iosModelUrl: row.ios_model_url,
        logoUrl: row.logo_url,
        ctaLabel: row.primary_cta_label || "Open site",
        arPlacement: row.ar_placement || "vertical-spin",
        arSpinSpeed: row.ar_spin_speed ?? 0.9,
        arScale: row.ar_scale ?? 1
      },
      200,
      {
        "cache-control": "no-store"
      }
    );
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Unable to load experience.", 500);
  }
}
