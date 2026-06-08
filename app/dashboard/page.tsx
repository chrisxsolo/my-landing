import type { Metadata } from "next";
import ClientSessionDashboard from "@/app/components/client-session-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Session Dashboard",
  description: "Track the progress of your SoloXSnaps photo session.",
};

export default function DashboardPage() {
  return <ClientSessionDashboard />;
}
