import { error, isValidSlug, json, readJson, requireAdmin } from "@/lib/server/http";
import { getQrAnalytics, recordAnalyticsEvent } from "@/lib/server/analytics-store";
import type { AnalyticsEventType } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type AnalyticsPayload = {
  event?: AnalyticsEventType;
};

const validEvents = new Set<AnalyticsEventType>(["qr_scan", "ar_open", "marker_lock", "cta_click"]);

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
    const analytics = await getQrAnalytics(slug);
    return json({ analytics });
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Unable to load analytics.", 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const slug = await routeSlug(context);
  if (!isValidSlug(slug)) {
    return error("Invalid slug.");
  }

  try {
    const body = await readJson<AnalyticsPayload>(request);

    if (!body.event || !validEvents.has(body.event) || body.event === "qr_scan" || body.event === "ar_open") {
      return error("Unsupported analytics event.");
    }

    const analytics = await recordAnalyticsEvent(slug, body.event);
    return json({ analytics });
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Unable to record analytics.", 500);
  }
}
