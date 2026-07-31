import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest, adminDbClient } from "@/lib/admin";

export const runtime = "nodejs";

// 혼동 문자 I/O/0/1 제외 — 코드 형식 PHX-EDU-XXXX
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let suffix = "";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) suffix += CODE_CHARS[byte % CODE_CHARS.length];
  return `PHX-EDU-${suffix}`;
}

// 코드 목록 (관리자)
export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  const supabase = adminDbClient();
  if (!supabase) return NextResponse.json({ error: "저장소가 설정되지 않았습니다." }, { status: 503 });

  const { data } = await supabase
    .from("invite_codes")
    .select("code, label, max_uses, used_count, active, created_by, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return NextResponse.json({ codes: data ?? [] });
}

// 코드 발급 (관리자)
export async function POST(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  const supabase = adminDbClient();
  if (!supabase) return NextResponse.json({ error: "저장소가 설정되지 않았습니다." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const label = String(body?.label || "").trim().slice(0, 100);
  const maxUses = Math.min(Math.max(Number(body?.maxUses) || 1, 1), 1000);

  // 충돌 시 몇 번 재시도
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    const { error } = await supabase.from("invite_codes").insert({
      code,
      label: label || null,
      max_uses: maxUses,
      created_by: admin.email
    });
    if (!error) return NextResponse.json({ ok: true, code });
    if (error.code !== "23505") {
      console.error(`[admin/invites] insert failed: ${error.message}`);
      return NextResponse.json({ error: "코드 발급에 실패했습니다." }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "코드 발급에 실패했습니다. 다시 시도해주세요." }, { status: 500 });
}

// 활성/비활성 전환 (관리자) — 비활성 = 회수 (redeem 불가)
export async function PATCH(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  const supabase = adminDbClient();
  if (!supabase) return NextResponse.json({ error: "저장소가 설정되지 않았습니다." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const code = String(body?.code || "");
  const active = Boolean(body?.active);
  if (!code) return NextResponse.json({ error: "코드가 필요합니다." }, { status: 400 });

  const { data, error } = await supabase
    .from("invite_codes")
    .update({ active })
    .eq("code", code)
    .select("code, active")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "코드 상태 변경에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, code: data.code, active: data.active });
}
