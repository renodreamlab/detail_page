"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { exchangeCode } from "@/lib/cloud-sync";

export default function AuthCallbackPage() {
  const router = useRouter();

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const finish = () => router.replace("/studio");
    if (code) {
      exchangeCode(code).then(finish).catch(finish);
    } else {
      finish();
    }
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#080d18] text-white">
      <p className="text-sm text-white/70">로그인 처리 중입니다...</p>
    </main>
  );
}
