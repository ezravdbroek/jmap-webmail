"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ShareTargetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const subject = searchParams.get("subject") || "";
    const body = searchParams.get("body") || searchParams.get("text") || "";
    const url = searchParams.get("url") || "";

    const composeBody = url ? `${body}\n\n${url}` : body;

    // Redirect to main page with compose params
    const params = new URLSearchParams();
    params.set("compose", "true");
    if (subject) params.set("subject", subject);
    if (composeBody) params.set("body", composeBody);

    router.replace(`/?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );
}
