import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, getProfile, getRecentLedger } from "@/lib/credits";

export const runtime = "nodejs";

// 내 잔액과 최근 장부 조회.
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const [profile, ledger] = await Promise.all([getProfile(user.id), getRecentLedger(user.id)]);
  return NextResponse.json({ credits: profile.credits, ledger });
}
