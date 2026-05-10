import { error, isValidSlug } from "@/lib/server/http";
import { getQrLink } from "@/lib/server/qr-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }> | { slug: string };
};

export async function GET(request: Request, context: RouteContext) {
  const slug = (await context.params).slug;

  if (!isValidSlug(slug)) {
    return error("Invalid QR code.", 400);
  }

  try {
    const link = await getQrLink(slug);

    if (!link || link.status !== "active") {
      return error("QR code not found.", 404);
    }

    if (link.kind === "ar") {
      const experienceSlug = link.experience_slug || link.slug;
      return Response.redirect(new URL(`/x/${experienceSlug}/`, request.url), 302);
    }

    if (!link.destination_url) {
      return error("QR code has no destination.", 500);
    }

    return Response.redirect(link.destination_url, 302);
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Unable to resolve QR code.", 500);
  }
}
