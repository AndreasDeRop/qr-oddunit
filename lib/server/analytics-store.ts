import { getRuntimeEnv } from "./env";
import { getQrLink, saveQrLink } from "./qr-store";
import type { AnalyticsDay, AnalyticsEventType, QrAnalytics } from "@/lib/types";

const ANALYTICS_KEY_PREFIX = "analytics:";
const maxDays = 30;

type LocalGlobal = typeof globalThis & {
  __oddunitAnalyticsLocalStore?: Map<string, QrAnalytics>;
};

function analyticsKey(slug: string) {
  return `${ANALYTICS_KEY_PREFIX}${slug}`;
}

function emptyAnalytics(slug: string): QrAnalytics {
  return {
    slug,
    totalScans: 0,
    arOpens: 0,
    markerLocks: 0,
    ctaClicks: 0,
    lastEventAt: null,
    days: []
  };
}

function localStore() {
  const target = globalThis as LocalGlobal;

  if (!target.__oddunitAnalyticsLocalStore) {
    target.__oddunitAnalyticsLocalStore = new Map();
  }

  return target.__oddunitAnalyticsLocalStore;
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

function normalizeAnalytics(slug: string, value: QrAnalytics | null | undefined): QrAnalytics {
  if (!value) {
    return emptyAnalytics(slug);
  }

  return {
    ...emptyAnalytics(slug),
    ...value,
    slug,
    days: Array.isArray(value.days) ? value.days.slice(-maxDays) : []
  };
}

function updateDay(days: AnalyticsDay[], date: string, eventType: AnalyticsEventType) {
  const nextDays = [...days];
  const index = nextDays.findIndex((day) => day.date === date);
  const day = index >= 0 ? nextDays[index] : { date, scans: 0, arOpens: 0, markerLocks: 0, ctaClicks: 0 };

  if (eventType === "qr_scan") {
    day.scans += 1;
  } else if (eventType === "ar_open") {
    day.arOpens += 1;
  } else if (eventType === "marker_lock") {
    day.markerLocks += 1;
  } else if (eventType === "cta_click") {
    day.ctaClicks += 1;
  }

  if (index >= 0) {
    nextDays[index] = day;
  } else {
    nextDays.push(day);
  }

  return nextDays.sort((a, b) => a.date.localeCompare(b.date)).slice(-maxDays);
}

async function getRawAnalytics(slug: string) {
  const namespace = kvNamespace();

  if (!namespace) {
    return normalizeAnalytics(slug, localStore().get(slug));
  }

  const raw = await namespace.get(analyticsKey(slug));
  return normalizeAnalytics(slug, raw ? (JSON.parse(raw) as QrAnalytics) : null);
}

async function saveAnalytics(analytics: QrAnalytics) {
  const namespace = kvNamespace();

  if (!namespace) {
    localStore().set(analytics.slug, analytics);
    return analytics;
  }

  await namespace.put(analyticsKey(analytics.slug), JSON.stringify(analytics), {
    metadata: {
      lastEventAt: analytics.lastEventAt,
      totalScans: analytics.totalScans,
      arOpens: analytics.arOpens,
      markerLocks: analytics.markerLocks,
      ctaClicks: analytics.ctaClicks
    }
  });

  return analytics;
}

export async function getQrAnalytics(slug: string) {
  return getRawAnalytics(slug);
}

export async function getAnalyticsForSlugs(slugs: string[]) {
  const entries = await Promise.all(slugs.map(async (slug) => [slug, await getQrAnalytics(slug)] as const));
  return Object.fromEntries(entries);
}

export async function recordAnalyticsEvent(slug: string, eventType: AnalyticsEventType) {
  const now = new Date();
  const iso = now.toISOString();
  const date = iso.slice(0, 10);
  const current = await getRawAnalytics(slug);
  const next: QrAnalytics = {
    ...current,
    totalScans: current.totalScans + (eventType === "qr_scan" ? 1 : 0),
    arOpens: current.arOpens + (eventType === "ar_open" ? 1 : 0),
    markerLocks: current.markerLocks + (eventType === "marker_lock" ? 1 : 0),
    ctaClicks: current.ctaClicks + (eventType === "cta_click" ? 1 : 0),
    lastEventAt: iso,
    days: updateDay(current.days, date, eventType)
  };

  await saveAnalytics(next);

  if (eventType === "qr_scan") {
    const link = await getQrLink(slug);
    if (link) {
      await saveQrLink({
        ...link,
        scans_count: (link.scans_count || 0) + 1,
        last_scanned_at: iso
      });
    }
  }

  return next;
}
