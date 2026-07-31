import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, getProfile, applyCredits, hasLedgerEntry } from "@/lib/credits";
import { serverFalKey, submitSeedanceJob, getSeedanceStatus, getSeedanceResult, buildMotionPrompt } from "@/lib/fal";
import { CREDIT_COSTS } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 120;

// 섹션 이미지 모션(시네마그래프) 생성.
// POST: 작업 제출(차감 없음) / GET: 상태 조회, 완료 시 1크레딧 차감(성공 결과물에만, 멱등).
// customer = 서버 FAL_KEY + 차감, student = 본인 키(x-fal-key 헤더) + 무차감.
async function resolveMode(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };

  const profile = await getProfile(user.id);
  const isStudent = profile.account_type === "student";
  const studentKey = (request.headers.get("x-fal-key") || "").trim();
  const falKey = isStudent ? studentKey : serverFalKey();
  if (!falKey) {
    return {
      error: NextResponse.json(
        {
          error: isStudent
            ? "수강생 계정은 본인 fal.ai 키가 필요합니다. API 키 설정에서 fal 키를 입력해주세요."
            : "영상 기능이 아직 준비되지 않았습니다. (서버 fal 키 미설정)"
        },
        { status: isStudent ? 400 : 503 }
      )
    };
  }
  return { user, profile, isStudent, falKey };
}

export async function POST(request: NextRequest) {
  try {
    const mode = await resolveMode(request);
    if ("error" in mode) return mode.error;
    const { profile, isStudent, falKey } = mode;

    if (!isStudent && profile.credits < CREDIT_COSTS.motion) {
      return NextResponse.json(
        { error: `크레딧이 부족합니다. (필요 ${CREDIT_COSTS.motion}, 보유 ${profile.credits}) 충전 후 이용해주세요.` },
        { status: 402 }
      );
    }

    const body = await request.json().catch(() => null);
    const imageUrl = String(body?.imageUrl || "");
    const preset = String(body?.preset || "natural");
    if (!imageUrl.startsWith("data:image/") && !imageUrl.startsWith("https://")) {
      return NextResponse.json({ error: "모션을 적용할 이미지가 필요합니다." }, { status: 400 });
    }

    const { requestId } = await submitSeedanceJob({
      falKey,
      prompt: buildMotionPrompt(preset),
      imageUrl,
      resolution: "1080p"
    });
    console.info(`[motion] submitted request=${requestId} student=${isStudent}`);
    return NextResponse.json({ requestId });
  } catch (error) {
    console.error("[api/motion] submit", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "모션 생성 요청에 실패했습니다." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const mode = await resolveMode(request);
    if ("error" in mode) return mode.error;
    const { user, isStudent, falKey } = mode;

    const requestId = new URL(request.url).searchParams.get("requestId") || "";
    if (!requestId) return NextResponse.json({ error: "requestId가 필요합니다." }, { status: 400 });

    const { status, queuePosition } = await getSeedanceStatus(falKey, requestId);
    if (status !== "COMPLETED") {
      const failed = status === "FAILED" || status === "ERROR";
      return NextResponse.json({ status: failed ? "FAILED" : status, queuePosition });
    }

    const { videoUrl } = await getSeedanceResult(falKey, requestId);

    // 성공 결과물에만 차감. 같은 requestId 재조회 시 이중 차감 방지(멱등).
    let creditsRemaining: number | null = null;
    if (!isStudent) {
      try {
        if (!(await hasLedgerEntry("motion", requestId))) {
          creditsRemaining = await applyCredits(user.id, -CREDIT_COSTS.motion, "모션 영상 1건", "motion", requestId);
        }
      } catch (error) {
        console.error(`[motion] charge failed request=${requestId}`, error);
      }
    }

    return NextResponse.json({ status: "COMPLETED", videoUrl, creditsRemaining });
  } catch (error) {
    console.error("[api/motion] status", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "모션 상태 조회에 실패했습니다." }, { status: 500 });
  }
}
