export type QrKind = "redirect" | "ar" | "vcard";
export type QrStatus = "active" | "paused" | "archived";

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
  status: QrStatus;
  scans_count?: number;
  last_scanned_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicExperience = {
  slug: string;
  title: string;
  destinationUrl: string;
  modelUrl: string;
  iosModelUrl: string | null;
  logoUrl: string | null;
  ctaLabel: string;
};
