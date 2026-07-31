import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest, adminDbClient } from "@/lib/admin";
import { applyCredits } from "@/lib/credits";

export const runtime = "nodejs";

// 회원 검색 (이메일 부분 일치) — 잔액·계정 정보 확인
export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  const supabase = adminDbClient();
  if (!supabase) return NextResponse.json({ error: "저장소가 설정되지 않았습니다." }, { status: 503 });

  const email = (new URL(request.url).searchParams.get("email") || "").trim().toLowerCase();

  // auth.users는 admin API로 조회
  const { data: usersData, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    console.error(`[admin/members] listUsers failed: ${error.message}`);
    return NextResponse.json({ error: "회원 목록 조회에 실패했습니다." }, { status: 500 });
  }

  const matched = usersData.users
    .filter((user) => !email || (user.email || "").toLowerCase().includes(email))
    .slice(0, 20);

  const ids = matched.map((user) => user.id);
  const { data: profiles } = ids.length > 0
    ? await supabase.from("profiles").select("id, credits, created_at").in("id", ids)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return NextResponse.json({
    members: matched.map((user) => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      credits: profileMap.get(user.id)?.credits ?? 0
    }))
  });
}

// 수동 지급·회수 (사유 필수, 장부 기록)
export async function POST(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const userId = String(body?.userId || "");
  const delta = Number(body?.delta || 0);
  const reason = String(body?.reason || "").trim().slice(0, 200);
  if (!userId || !Number.isInteger(delta) || delta === 0) {
    return NextResponse.json({ error: "대상 회원과 지급/회수 수량이 필요합니다." }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "사유를 입력해주세요. (장부에 기록됩니다)" }, { status: 400 });
  }
  if (Math.abs(delta) > 10000) {
    return NextResponse.json({ error: "한 번에 처리할 수 있는 수량은 10,000 이하입니다." }, { status: 400 });
  }

  try {
    const balance = await applyCredits(userId, delta, `[관리자] ${reason}`, "admin", admin.email || "admin");
    return NextResponse.json({ ok: true, balance });
  } catch (error) {
    const message = error instanceof Error ? error.message : "처리에 실패했습니다.";
    // 잔액 부족(check 제약) 등의 사유를 사람이 읽을 수 있게 전달
    if (message.includes("check")) {
      return NextResponse.json({ error: "회수 수량이 보유 잔액보다 많습니다." }, { status: 400 });
    }
    console.error("[admin/members] apply failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
