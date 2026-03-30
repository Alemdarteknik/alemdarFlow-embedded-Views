"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";

function HomeRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/systems/all");
  }, [router]);

  return null;
}

export default function HomePageWithAuth() {
  return (
    <AuthGuard>
      <HomeRedirectPage />
    </AuthGuard>
  );
}
