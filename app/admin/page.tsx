import type { Metadata } from "next";
import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = { title: "Beheer", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminDashboard />;
}
