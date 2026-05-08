import type { Metadata } from "next";
import AdminSessionsDashboard from "@/app/components/admin-sessions-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client Sessions | SoloXSnaps Admin",
  description: "Manage SoloXSnaps client photo session progress.",
};

export default function AdminSessionsPage() {
  return <AdminSessionsDashboard />;
}
