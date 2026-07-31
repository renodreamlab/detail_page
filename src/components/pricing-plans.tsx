"use client";

import * as React from "react";
import { PLANS, type Plan } from "@/lib/plans";
import { isCloudEnabled, signInWithGoogle, onAuthChange, getAccessToken } from "@/lib/cloud-sync";
import { type User } from "@supabase/supabase-js";

declare global {
  interface Window {
    TossPayments?: any;
  }
}

const TOSS_SDK_URL = "https://js.tosspayments.com/v2/standard";

const bankInfo = {
  name: process.env.NEXT_PUBLIC_BANK_NAME || "",
  account: process.env.NEXT_PUBLIC_BANK_ACCOUNT || "",
  holder: process.env.NEXT_PUBLIC_BANK_HOLDER || ""
};

function loadTossSdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.TossPayments) return resolve(window.TossPayments);
    const script = document.createElement("script");
    script.src = TOSS_SDK_URL;
    script.onload = () => (window.TossPayments ? resolve(window.TossPayments) : reject(new Error("결제 모듈을 불러오지 못했습니다.")));
    script.onerror = () => reject(new Error("결제 모듈을 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

export function PricingPlans() {
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "";
  const [user, setUser] = React.useState<User | null>(null);
  const [busyPlanId, setBusyPlanId] = React.useState<string | null>(null);
  const [bankPlan, setBankPlan] = React.useState<Plan | null>(null);
  const [depositorName, setDepositorName] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [bankDone, setBankDone] = React.useState(false);

  React.useEffect(() => {
    if (!isCloudEnabled()) return;
    return onAuthChange(setUser);
  }, []);

  async function ensureLogin(): Promise<boolean> {
    if (user) return true;
    setMessage("결제하려면 먼저 Google 로그인이 필요합니다. 로그인 후 다시 시도해주세요.");
    try {
      await signInWithGoogle();
    } catch {
      // 로그인 창 이동 실패 시 메시지 유지
    }
    return false;
  }

  async function payWithCard(plan: Plan) {
    setMessage("");
    if (!clientKey) {
      setMessage("카드 결제가 아직 준비되지 않았습니다. 무통장 입금을 이용해주세요.");
      return;
    }
    if (!(await ensureLogin())) return;

    setBusyPlanId(plan.id);
    try {
      const TossPayments = await loadTossSdk();
      const tossPayments = TossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: TossPayments.ANONYMOUS });
      const orderId = `order-${crypto.randomUUID()}`;
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: plan.amount },
        orderId,
        orderName: `${plan.name} ${plan.credits}크레딧`,
        successUrl: `${window.location.origin}/pricing/success?planId=${plan.id}`,
        failUrl: `${window.location.origin}/pricing/fail`,
        card: { useEscrow: false, flowMode: "DEFAULT", useCardPoint: false, useAppCardOnly: false }
      });
    } catch (error: any) {
      // 사용자가 결제창을 닫은 경우도 여기로 온다.
      if (error?.code !== "USER_CANCEL") {
        setMessage(error?.message || "결제창을 여는 중 오류가 발생했습니다.");
      }
    } finally {
      setBusyPlanId(null);
    }
  }

  async function requestBankTransfer() {
    if (!bankPlan) return;
    const name = depositorName.trim();
    if (!name) {
      setMessage("입금자명을 입력해주세요.");
      return;
    }
    if (!(await ensureLogin())) return;

    setBusyPlanId(bankPlan.id);
    setMessage("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/bank-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ planId: bankPlan.id, depositorName: name })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "신청에 실패했습니다.");
      setBankDone(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "신청에 실패했습니다.");
    } finally {
      setBusyPlanId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        {PLANS.map((plan) => (
          <div key={plan.id} className="flex flex-col rounded-2xl border border-black/8 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
            <div className="text-sm font-bold text-neutral-500">{plan.name}</div>
            <div className="mt-2 text-3xl font-extrabold tracking-tight">
              {plan.credits}<span className="ml-1 text-base font-bold text-neutral-400">크레딧</span>
            </div>
            <div className="mt-1 text-lg font-bold text-[#ff6f61]">{plan.amount.toLocaleString()}원</div>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-neutral-500">{plan.description}</p>
            <p className="mt-1 text-[11px] text-neutral-400">장당 약 {Math.round(plan.amount / plan.credits).toLocaleString()}원</p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                disabled={busyPlanId === plan.id}
                onClick={() => payWithCard(plan)}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#1a1a1a] px-4 text-sm font-bold text-white transition hover:bg-black disabled:opacity-60"
              >
                {busyPlanId === plan.id ? "결제창 여는 중..." : "카드로 결제"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBankPlan(plan);
                  setBankDone(false);
                  setMessage("");
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-700 transition hover:border-neutral-500"
              >
                무통장 입금
              </button>
            </div>
          </div>
        ))}
      </div>

      {message ? <p className="text-sm font-semibold text-red-600">{message}</p> : null}

      {bankPlan ? (
        <div className="rounded-2xl border border-black/8 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
          {bankDone ? (
            <div className="grid gap-2">
              <div className="text-base font-extrabold">무통장 입금 신청 완료</div>
              <p className="text-sm leading-relaxed text-neutral-600">
                아래 계좌로 <strong>{bankPlan.amount.toLocaleString()}원</strong>을 입금해주세요.
                입금 확인 후 관리자가 승인하면 <strong>{bankPlan.credits}크레딧</strong>이 지급됩니다.
              </p>
              <BankAccountInfo />
              <button
                type="button"
                onClick={() => setBankPlan(null)}
                className="mt-2 inline-flex min-h-10 w-fit items-center justify-center rounded-md border border-neutral-300 px-4 text-sm font-bold text-neutral-700"
              >
                닫기
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="text-base font-extrabold">
                무통장 입금 신청 — {bankPlan.name} {bankPlan.credits}크레딧 ({bankPlan.amount.toLocaleString()}원)
              </div>
              <BankAccountInfo />
              <label className="grid gap-1 text-sm font-semibold text-neutral-600">
                입금자명
                <input
                  value={depositorName}
                  onChange={(event) => setDepositorName(event.target.value)}
                  placeholder="입금하실 분 성함"
                  className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyPlanId === bankPlan.id}
                  onClick={requestBankTransfer}
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#ff6f61] px-5 text-sm font-bold text-white transition hover:bg-[#ff806f] disabled:opacity-60"
                >
                  {busyPlanId === bankPlan.id ? "신청 중..." : "신청하기"}
                </button>
                <button
                  type="button"
                  onClick={() => setBankPlan(null)}
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-5 text-sm font-bold text-neutral-700"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function BankAccountInfo() {
  if (!bankInfo.name || !bankInfo.account) {
    return <p className="text-sm text-neutral-500">입금 계좌 안내가 아직 준비되지 않았습니다. 관리자에게 문의해주세요.</p>;
  }
  return (
    <div className="rounded-md bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-700">
      <div><strong>{bankInfo.name}</strong> {bankInfo.account}</div>
      <div>예금주: {bankInfo.holder}</div>
    </div>
  );
}
