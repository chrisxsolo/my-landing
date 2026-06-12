import type { Metadata } from "next";
import EngineDashboard from "@/app/admin/content-engine/EngineDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Content Engine",
  description: "Session-to-marketing content workflow.",
};

export default function ContentEnginePage() {
  return <EngineDashboard />;
}
