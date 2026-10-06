export type QrKind = "redirect" | "ar" | "vcard";
export type QrStatus = "active" | "paused" | "archived";
export type ArPlacement = "vertical-spin" | "horizontal-rise";
export type AnalyticsEventType = "qr_scan" | "ar_open" | "marker_lock" | "cta_click";

export type AnalyticsDay = {
  date: string;
  scans: number;
  arOpens: number;
  markerLocks: number;
  ctaClicks: number;
};

export type QrAnalytics = {
  slug: string;
  totalScans: number;
  arOpens: number;
  markerLocks: number;
  ctaClicks: number;
  lastEventAt: string | null;
  days: AnalyticsDay[];
};

export type QrLink = {
  id: string;
  slug: string;
  title: string;
  kind: QrKind;
  destination_url: string | null;
  experience_slug: string | null;
  model_url: string | null;
  ios_model_url: string | null;
  logo_url: string | null;
  primary_cta_label: string | null;
  ar_placement?: ArPlacement | null;
  ar_spin_speed?: number | null;
  ar_scale?: number | null;
  status: QrStatus;
  scans_count?: number;
  last_scanned_at?: string | null;
  analytics?: QrAnalytics;
  created_at: string;
  updated_at: string;
};

export type PublicExperience = {
  slug: string;
  qrSlugs: string[];
  title: string;
  destinationUrl: string;
  modelUrl: string;
  iosModelUrl: string | null;
  logoUrl: string | null;
  ctaLabel: string;
  arPlacement: ArPlacement;
  arSpinSpeed: number;
  arScale: number;
};
