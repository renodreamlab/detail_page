"use client";

import * as React from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/cloud-sync";

type ConfirmState = "confirming" | "done" | "error";

// 토스 성공 리다이렉트 수신 → 서버 승인 호출 → 결과 표시.
// 실제 승인·금액 대조·지급은 전부 /api/payments/confirm(서버)에서 처리한다.
export default function PaymentSuccessPage() {
  const [state, setState] = React.useState<ConfirmState>("confirming");
  const [message, setMessage] = React.useState("");
  const [balance, setBalance] = React.useState<number | null>(null);
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const paymentKey = params.get("paymentKey") || "";
    const orderId = params.get("orderId") || "";
    const amount = Number(params.get("amount") || 0);
    const planId = params.get("planId") || "";

    if (!paymentKey || !orderId || !amount || !planId) {
      setState("error");
      setMessage("결제 정보가 올바르지 않습니다.");
      return;
    }

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("로그인 세션이 만료되었습니다. 다시 로그인 후 고객센터에 문의해주세요.");
        const response = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ paymentKey, orderId, amount, planId })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "결제 승인에 실패했습니다.");
        if (typeof data.balance === "number") setBalance(data.balance);
        setState("done");
      } catch (error) {
        setState("error");
        setMessage(error instanceof Error ? error.message : "결제 승인 중 오류가 발생했습니다.");
      }
    })();
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f4ef] px-5">
      <div className="w-full max-w-md rounded-2xl border border-black/8 bg-white p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        {state === "confirming" ? (
          <>
            <div className="text-lg font-extrabold">결제 승인 중...</div>
            <p className="mt-2 text-sm text-neutral-500">잠시만 기다려주세요. 창을 닫지 마세요.</p>
          </>
        ) : state === "done" ? (
          <>
            <div className="text-lg font-extrabold text-[#0d9488]">충전 완료! 🎉</div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              크레딧이 지급되었습니다.
              {balance !== null ? <> 현재 잔액: <strong>{balance}크레딧</strong></> : null}
            </p>
            <Link
              href="/studio"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[#ff6f61] px-5 text-sm font-bold text-white transition hover:bg-[#ff806f]"
            >
              제작실로 돌아가기
            </Link>
          </>
        ) : (
          <>
            <div className="text-lg font-extrabold text-red-600">승인 실패</div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{message}</p>
            <Link
              href="/pricing"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-neutral-300 px-5 text-sm font-bold text-neutral-700"
            >
              가격 페이지로 돌아가기
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
