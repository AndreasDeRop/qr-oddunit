import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only public canonical content. Customer camera sessions, redirects, admin
  // and checkout are deliberately excluded. Update on substantive site edits.
  return [
    { url: siteUrl, lastModified: "2026-10-06", priority: 1 },
    { url: `${siteUrl}/editor`, lastModified: "2026-10-06", priority: .7 }
  ];
}
