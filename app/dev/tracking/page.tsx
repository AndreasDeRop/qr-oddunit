import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TrackingFixture } from "./tracking-fixture";

export const metadata: Metadata = { title: "Tracking test", robots: { index: false, follow: false } };

export default function TrackingTestPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <TrackingFixture />;
}
