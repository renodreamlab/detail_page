import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/lib/credits";

export const runtime = "nodejs";

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// 초대 코드 사용: 성공 시 student(수강생) 계정으로 전환된다.
// redeem_invite_code()가 사용 횟수 증가와 전환을 원자적으로 처리한다(한도 초과 불가).
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const code = String(body?.code || "").trim();
  if (!code) {
    return NextResponse.json({ error: "초대 코드를 입력해주세요." }, { status: 400 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json({ error: "저장소가 설정되지 않았습니다." }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("redeem_invite_code", {
    p_user_id: user.id,
    p_code: code
  });
  if (error) {
    console.error(`[invite] redeem failed: ${error.message}`);
    return NextResponse.json({ error: "코드 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "유효하지 않거나 이미 사용된 코드입니다." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, code: data, accountType: "student" });
}
