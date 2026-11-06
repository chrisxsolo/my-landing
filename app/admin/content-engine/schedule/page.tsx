import type { Metadata } from "next";
import ScheduleQueue from "@/app/admin/content-engine/schedule/ScheduleQueue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Publishing queue", description: "Upcoming scheduled publications." };

export default function SchedulePage() {
  return <ScheduleQueue />;
}
