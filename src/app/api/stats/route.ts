import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

// 운영 모니터링: 헤더 토큰(MONITOR_TOKEN) 검사. /api/health는 무인증 유지.
// 사용: curl -H "Authorization: Bearer <MONITOR_TOKEN>" https://<도메인>/api/stats

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(request: NextRequest) {
  const expected = (process.env.MONITOR_TOKEN || "").trim();
  const provided = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!expected || !provided || !secureEquals(expected, provided)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  }

  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [profiles, projects, payments, ledger, bankPending, recentSignups] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase.from("payments").select("amount, credits"),
    supabase.from("credit_ledger").select("delta, ref_type").lt("delta", 0),
    supabase.from("bank_transfer_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since7d)
  ]);

  const paymentRows = payments.data ?? [];
  const spendRows = ledger.data ?? [];
  const spentBy = (refType: string) =>
    spendRows.filter((row) => row.ref_type === refType).reduce((sum, row) => sum + Math.abs(Number(row.delta) || 0), 0);

  const imagesGenerated = spentBy("image");
  const motions = spentBy("motion");
  const promos = spentBy("promo_video");

  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    users: profiles.count ?? 0,
    usersLast7d: recentSignups.count ?? 0,
    projects: projects.count ?? 0,
    payments: {
      count: paymentRows.length,
      totalKrw: paymentRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
      totalCredits: paymentRows.reduce((sum, row) => sum + (Number(row.credits) || 0), 0)
    },
    usage: {
      imagesGenerated,
      motions,
      promoVideoCredits: promos,
      // 대략적 원가 추정: 이미지 1장 ~ $0.17, 모션 1건 ~ $0.25 기준
      estimatedCostUsd: Math.round((imagesGenerated * 0.17 + motions * 0.25) * 100) / 100
    },
    alerts: {
      pendingBankTransfers: bankPending.count ?? 0
    }
  });
}
