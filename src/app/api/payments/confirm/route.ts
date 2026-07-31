import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest, applyCredits } from "@/lib/credits";
import { findPlan } from "@/lib/plans";

export const runtime = "nodejs";

// 토스 결제 승인: 반드시 서버에서 승인 API를 호출하고, 금액을 상품표와 대조한 뒤
// payments 기록(order_id 유니크로 이중 적립 차단) 후 크레딧을 지급한다.
export async function POST(request: NextRequest) {
  const secretKey = process.env.TOSS_SECRET_KEY || "";
  if (!secretKey) {
    return NextResponse.json({ error: "결제 설정이 완료되지 않았습니다." }, { status: 503 });
  }

  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const paymentKey = String(body?.paymentKey || "");
  const orderId = String(body?.orderId || "");
  const amount = Number(body?.amount || 0);
  const planId = String(body?.planId || "");
  if (!paymentKey || !orderId || !amount || !planId) {
    return NextResponse.json({ error: "결제 승인 정보가 부족합니다." }, { status: 400 });
  }

  // 1) 금액을 서버 상품표와 대조 — 클라이언트 금액 조작 차단
  const plan = findPlan(planId);
  if (!plan || plan.amount !== amount) {
    return NextResponse.json({ error: "결제 금액이 상품 정보와 일치하지 않습니다." }, { status: 400 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json({ error: "결제 저장소가 설정되지 않았습니다." }, { status: 503 });
  }

  // 2) 이미 처리된 주문이면 이중 적립하지 않고 성공으로 응답(멱등)
  const { data: existing } = await supabase.from("payments").select("id, status").eq("order_id", orderId).maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, duplicated: true, credits: plan.credits });
  }

  // 3) 토스 승인 API 호출 (서버에서만, 시크릿 키 Basic 인증)
  const confirmResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ paymentKey, orderId, amount })
  });
  const confirmData = await confirmResponse.json().catch(() => ({}));
  if (!confirmResponse.ok) {
    const message = confirmData?.message || "결제 승인에 실패했습니다.";
    console.error(`[payments/confirm] toss confirm failed order=${orderId}: ${message}`);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 승인 응답 금액도 재검증
  if (Number(confirmData?.totalAmount) !== plan.amount) {
    console.error(`[payments/confirm] amount mismatch order=${orderId}`);
    return NextResponse.json({ error: "승인 금액이 일치하지 않습니다." }, { status: 400 });
  }

  // 4) payments 기록 (order_id 유니크 제약이 동시 요청 이중 적립도 차단)
  const { error: insertError } = await supabase.from("payments").insert({
    user_id: user.id,
    order_id: orderId,
    payment_key: paymentKey,
    plan_id: plan.id,
    amount: plan.amount,
    credits: plan.credits,
    status: "done",
    approved_at: confirmData?.approvedAt || new Date().toISOString()
  });
  if (insertError) {
    // 유니크 충돌 = 다른 요청이 먼저 처리함 → 지급 없이 성공 응답
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, duplicated: true, credits: plan.credits });
    }
    console.error(`[payments/confirm] insert failed order=${orderId}: ${insertError.message}`);
    return NextResponse.json({ error: "결제 기록 저장에 실패했습니다. 고객센터에 문의해주세요." }, { status: 500 });
  }

  // 5) 크레딧 지급 (원자 함수)
  try {
    const balance = await applyCredits(user.id, plan.credits, `${plan.name} 충전 ${plan.credits}크레딧`, "card", orderId);
    console.info(`[payments/confirm] done order=${orderId} plan=${plan.id} balance=${balance}`);
    return NextResponse.json({ ok: true, credits: plan.credits, balance });
  } catch (error) {
    console.error(`[payments/confirm] credit grant failed order=${orderId}`, error);
    return NextResponse.json({ error: "결제는 완료됐지만 크레딧 지급에 실패했습니다. 고객센터에 문의해주세요." }, { status: 500 });
  }
}

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
