import type { ReactNode } from "react";
import AdminSessionBoundary from "./AdminSessionBoundary";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminSessionBoundary>{children}</AdminSessionBoundary>;
}
