import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, getProfile, applyCredits, hasLedgerEntry } from "@/lib/credits";
import { serverFalKey, submitSeedanceJob, getSeedanceStatus, getSeedanceResult, type FalResolution } from "@/lib/fal";
import { CREDIT_COSTS } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 120;

// 홍보영상: 히어로 이미지 기반 5초 프로모션 클립.
// 표준 720p = 8크레딧 / 프리미엄 1080p = 18크레딧 (성공 결과물에만, 멱등 차감).
// customer = 서버 FAL_KEY + 차감, student = 본인 키(x-fal-key) + 무차감.

function costFor(resolution: FalResolution): number {
  return resolution === "1080p" ? CREDIT_COSTS.promo1080 : CREDIT_COSTS.promo720;
}

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

    const body = await request.json().catch(() => null);
    const imageUrl = String(body?.imageUrl || "");
    const resolution: FalResolution = body?.resolution === "1080p" ? "1080p" : "720p";
    const requestText = String(body?.request || "").slice(0, 500);
    const cost = costFor(resolution);

    if (!isStudent && profile.credits < cost) {
      return NextResponse.json(
        { error: `크레딧이 부족합니다. (필요 ${cost}, 보유 ${profile.credits}) 충전 후 이용해주세요.` },
        { status: 402 }
      );
    }
    if (!imageUrl.startsWith("data:image/") && !imageUrl.startsWith("https://")) {
      return NextResponse.json({ error: "홍보영상에 사용할 이미지가 필요합니다." }, { status: 400 });
    }

    const prompt = [
      "커머스 제품 홍보 영상 스타일의 시네마틱 클립.",
      "제품이 화면의 주인공으로 자연스럽고 고급스럽게 강조된다. 부드러운 카메라 느낌의 빛 변화와 미세한 제품 강조 모션.",
      requestText ? `연출 요청: ${requestText}` : "",
      "작은 버튼, 캡션, 글자 픽셀은 전부 고정한다. 모션 효과가 텍스트 영역을 통과하지 않게 한다. 텍스트와 레이아웃은 절대 변형하지 않는다."
    ].filter(Boolean).join(" ");

    const { requestId } = await submitSeedanceJob({ falKey, prompt, imageUrl, resolution });
    console.info(`[promo-video] submitted request=${requestId} resolution=${resolution} student=${isStudent}`);
    return NextResponse.json({ requestId, resolution, cost });
  } catch (error) {
    console.error("[api/promo-video] submit", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "홍보영상 요청에 실패했습니다." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const mode = await resolveMode(request);
    if ("error" in mode) return mode.error;
    const { user, isStudent, falKey } = mode;

    const url = new URL(request.url);
    const requestId = url.searchParams.get("requestId") || "";
    const resolution: FalResolution = url.searchParams.get("resolution") === "1080p" ? "1080p" : "720p";
    if (!requestId) return NextResponse.json({ error: "requestId가 필요합니다." }, { status: 400 });

    const { status, queuePosition } = await getSeedanceStatus(falKey, requestId);
    if (status !== "COMPLETED") {
      const failed = status === "FAILED" || status === "ERROR";
      return NextResponse.json({ status: failed ? "FAILED" : status, queuePosition });
    }

    const { videoUrl } = await getSeedanceResult(falKey, requestId);

    let creditsRemaining: number | null = null;
    if (!isStudent) {
      try {
        if (!(await hasLedgerEntry("promo_video", requestId))) {
          creditsRemaining = await applyCredits(
            user.id,
            -costFor(resolution),
            `홍보영상 ${resolution} 1건`,
            "promo_video",
            requestId
          );
        }
      } catch (error) {
        console.error(`[promo-video] charge failed request=${requestId}`, error);
      }
    }

    return NextResponse.json({ status: "COMPLETED", videoUrl, creditsRemaining });
  } catch (error) {
    console.error("[api/promo-video] status", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "홍보영상 상태 조회에 실패했습니다." }, { status: 500 });
  }
}
