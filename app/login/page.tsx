import type { Metadata } from "next";
import { Suspense } from "react";
import LoginPanel from "@/app/components/login-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login | SoloXSnaps",
  description: "Log in to your SoloXSnaps client portal.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPanel />
    </Suspense>
  );
}
