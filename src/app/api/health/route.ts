import { NextResponse } from "next/server";

export const runtime = "nodejs";

// 배포 확인 기준 라우트: commit 값이 새 커밋으로 바뀌면 배포 완료로 판단한다.
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "renoable-detail-page",
    time: new Date().toISOString(),
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || "local"
  });
}
