import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scan je QR-code in AR",
  description: "Open de camera en richt op de volledige QR-code om het 3D-logo te bekijken.",
  robots: { index: false, follow: true }
};

export default function ExperienceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
