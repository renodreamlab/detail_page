import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/lib/credits";
import { findPlan } from "@/lib/plans";

export const runtime = "nodejs";

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// 무통장 입금 신청: pending으로 쌓고, 지급은 관리자 승인(Phase 5)에서 처리한다.
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const planId = String(body?.planId || "");
  const depositorName = String(body?.depositorName || "").trim().slice(0, 40);
  const plan = findPlan(planId);
  if (!plan) {
    return NextResponse.json({ error: "상품 정보를 찾을 수 없습니다." }, { status: 400 });
  }
  if (!depositorName) {
    return NextResponse.json({ error: "입금자명을 입력해주세요." }, { status: 400 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json({ error: "저장소가 설정되지 않았습니다." }, { status: 503 });
  }

  const { error } = await supabase.from("bank_transfer_requests").insert({
    user_id: user.id,
    user_email: user.email,
    plan_id: plan.id,
    amount: plan.amount,
    credits: plan.credits,
    depositor_name: depositorName,
    status: "pending"
  });
  if (error) {
    console.error(`[bank-transfer] insert failed: ${error.message}`);
    return NextResponse.json({ error: "신청 저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// 내 무통장 신청 목록 (pending 상태 확인용)
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json({ error: "저장소가 설정되지 않았습니다." }, { status: 503 });
  }

  const { data } = await supabase
    .from("bank_transfer_requests")
    .select("plan_id, amount, credits, depositor_name, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);
  return NextResponse.json({ requests: data ?? [] });
}
