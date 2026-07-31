// fal.ai Seedance 1.5 Pro image-to-video 공통 헬퍼.
// 제출 경로와 상태/결과 조회 경로가 다르다는 점에 주의:
//  - 제출:      https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/image-to-video
//  - 상태/결과: https://queue.fal.run/fal-ai/bytedance/requests/{id}(/status)  <- 앱 루트 경로

const FAL_SUBMIT_URL = "https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/image-to-video";
const FAL_REQUESTS_ROOT = "https://queue.fal.run/fal-ai/bytedance/requests";

export type FalResolution = "720p" | "1080p";

// customer는 서버 FAL_KEY, student는 요청 헤더(x-fal-key)의 본인 키(서버 미저장).
export function serverFalKey(): string {
  return process.env.FAL_KEY || "";
}

export async function submitSeedanceJob({
  falKey,
  prompt,
  imageUrl,
  resolution = "1080p"
}: {
  falKey: string;
  prompt: string;
  imageUrl: string;
  resolution?: FalResolution;
}): Promise<{ requestId: string }> {
  const response = await fetch(FAL_SUBMIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt,
      image_url: imageUrl,
      duration: 5,
      resolution,
      // 미지정 시 16:9로 나와 세로 이미지가 확대된다 — 반드시 auto
      aspect_ratio: "auto",
      camera_fixed: true
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.detail?.[0]?.msg || data?.detail || data?.message || `영상 작업 제출 실패 (${response.status})`;
    throw new Error(typeof message === "string" ? message : "영상 작업 제출에 실패했습니다.");
  }
  const requestId = String(data?.request_id || "");
  if (!requestId) throw new Error("영상 작업 ID를 받지 못했습니다.");
  return { requestId };
}

export async function getSeedanceStatus(falKey: string, requestId: string): Promise<{ status: string; queuePosition?: number }> {
  const response = await fetch(`${FAL_REQUESTS_ROOT}/${encodeURIComponent(requestId)}/status`, {
    headers: { Authorization: `Key ${falKey}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`영상 상태 조회 실패 (${response.status})`);
  }
  return { status: String(data?.status || "UNKNOWN"), queuePosition: data?.queue_position };
}

export async function getSeedanceResult(falKey: string, requestId: string): Promise<{ videoUrl: string }> {
  const response = await fetch(`${FAL_REQUESTS_ROOT}/${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Key ${falKey}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`영상 결과 조회 실패 (${response.status})`);
  }
  const videoUrl = String(data?.video?.url || "");
  if (!videoUrl) throw new Error("영상 결과 URL이 없습니다.");
  return { videoUrl };
}

export const MOTION_PRESETS: Record<string, string> = {
  steam: "제품 주변에서 은은한 김이 천천히 피어오른다.",
  light: "부드러운 빛줄기가 제품 위를 자연스럽게 쓸고 지나간다.",
  sparkle: "미세한 반짝임 입자가 제품 주위에서 은은하게 빛난다.",
  float: "제품이 아주 미세하게 떠오르듯 부드럽게 움직인다.",
  natural: "배경 요소가 자연스럽고 미세하게 움직인다."
};

export const MOTION_PROMPT_SUFFIX =
  "작은 버튼, 캡션, 글자 픽셀은 전부 고정한다. 모션 효과가 텍스트 영역을 통과하지 않게 한다. 텍스트와 레이아웃은 절대 변형하지 않는다. 미세하고 고급스러운 시네마그래프 스타일.";

export function buildMotionPrompt(presetOrText: string): string {
  const base = MOTION_PRESETS[presetOrText] || presetOrText.trim() || MOTION_PRESETS.natural;
  return `${base} ${MOTION_PROMPT_SUFFIX}`;
}
