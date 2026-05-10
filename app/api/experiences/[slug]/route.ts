import { error, isValidSlug, json } from "@/lib/server/http";
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

    return json(
      {
        slug: row.experience_slug || row.slug,
        title: row.title,
        destinationUrl: row.destination_url || "https://oddunit.be",
        modelUrl: row.model_url || "/models/oddunit-logo.gltf",
        iosModelUrl: row.ios_model_url,
        logoUrl: row.logo_url,
        ctaLabel: row.primary_cta_label || "Open site"
      },
      200,
      {
        "cache-control": "public, max-age=60"
      }
    );
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Unable to load experience.", 500);
  }
}
