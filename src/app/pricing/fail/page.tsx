"use client";

import * as React from "react";
import Link from "next/link";

// 토스 실패 리다이렉트 수신. 결제·지급은 일어나지 않은 상태다.
export default function PaymentFailPage() {
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReason(params.get("message") || "결제가 취소되었거나 실패했습니다.");
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f4ef] px-5">
      <div className="w-full max-w-md rounded-2xl border border-black/8 bg-white p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="text-lg font-extrabold text-red-600">결제 실패</div>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">{reason}</p>
        <p className="mt-1 text-xs text-neutral-400">카드 결제가 진행되지 않았으며 크레딧도 차감되지 않았습니다.</p>
        <Link
          href="/pricing"
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[#1a1a1a] px-5 text-sm font-bold text-white transition hover:bg-black"
        >
          다시 시도하기
        </Link>
      </div>
    </main>
  );
}
