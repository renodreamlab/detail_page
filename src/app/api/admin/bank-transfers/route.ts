import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest, adminDbClient } from "@/lib/admin";
import { applyCredits } from "@/lib/credits";

export const runtime = "nodejs";

// 무통장 입금 신청 목록 (관리자)
export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  const supabase = adminDbClient();
  if (!supabase) return NextResponse.json({ error: "저장소가 설정되지 않았습니다." }, { status: 503 });

  const status = new URL(request.url).searchParams.get("status") || "pending";
  const query = supabase
    .from("bank_transfer_requests")
    .select("id, user_id, user_email, plan_id, amount, credits, depositor_name, status, admin_memo, decided_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const { data } = status === "all" ? await query : await query.eq("status", status);
  return NextResponse.json({ requests: data ?? [] });
}

// 승인/거절 처리 (관리자)
export async function POST(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  const supabase = adminDbClient();
  if (!supabase) return NextResponse.json({ error: "저장소가 설정되지 않았습니다." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const requestId = String(body?.requestId || "");
  const action = body?.action === "approve" ? "approve" : body?.action === "reject" ? "reject" : "";
  const memo = String(body?.memo || "").slice(0, 500);
  if (!requestId || !action) {
    return NextResponse.json({ error: "처리할 신청과 동작이 필요합니다." }, { status: 400 });
  }

  // pending 상태에서만 상태 전이(중복 승인으로 인한 이중 지급 차단)
  const { data: updated, error: updateError } = await supabase
    .from("bank_transfer_requests")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      admin_memo: memo || null,
      decided_at: new Date().toISOString(),
      decided_by: admin.email
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id, user_id, plan_id, amount, credits, depositor_name")
    .maybeSingle();

  if (updateError) {
    console.error(`[admin/bank-transfers] update failed: ${updateError.message}`);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "이미 처리됐거나 존재하지 않는 신청입니다." }, { status: 409 });
  }

  if (action === "approve") {
    try {
      const balance = await applyCredits(
        updated.user_id,
        updated.credits,
        `무통장 입금 승인 (${updated.depositor_name}, ${Number(updated.amount).toLocaleString()}원)`,
        "bank_transfer",
        updated.id
      );
      return NextResponse.json({ ok: true, action, balance });
    } catch (error) {
      // 지급 실패 시 상태를 pending으로 되돌려 재시도 가능하게 한다.
      await supabase
        .from("bank_transfer_requests")
        .update({ status: "pending", decided_at: null, decided_by: null })
        .eq("id", requestId);
      console.error("[admin/bank-transfers] credit grant failed", error);
      return NextResponse.json({ error: "크레딧 지급에 실패해 승인을 되돌렸습니다. 다시 시도해주세요." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, action });
}
