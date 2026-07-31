import { NextRequest, NextResponse } from "next/server";
import { openAIImageSizeForRatio, ratioEditPromptInstruction } from "@/lib/image-spec";
import { getUserFromRequest, getProfile, applyCredits, serverImageKeyFor } from "@/lib/credits";

export const runtime = "nodejs";
export const maxDuration = 300;

const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || "high";
const OPENAI_IMAGE_FALLBACK_QUALITY = process.env.OPENAI_IMAGE_FALLBACK_QUALITY || "medium";
const OPENAI_IMAGE_PARTIAL_IMAGES = process.env.OPENAI_IMAGE_PARTIAL_IMAGES || "1";
const OPENAI_IMAGE_HIGH_TIMEOUT_MS = Number(process.env.OPENAI_IMAGE_HIGH_TIMEOUT_MS || 240000);
const OPENAI_IMAGE_FALLBACK_TIMEOUT_MS = Number(process.env.OPENAI_IMAGE_FALLBACK_TIMEOUT_MS || 240000);
const GOOGLE_NANO_BANANA_2_MODEL = "gemini-3.1-flash-image-preview";

type Provider = "openai" | "google";
type EditedImage = {
  mimeType: string;
  buffer: Buffer;
  fallbackNotice?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const provider: Provider = body.model === "google" ? "google" : "openai";
    const image = parseDataUrl(String(body.imageUrl || ""));
    const requestText = String(body.request || "");
    const section = body.section || {};
    const project = body.project || {};
    const openaiKey = String(body.openaiKey || "");
    const googleKey = String(body.googleKey || "");
    const clientKey = provider === "google" ? googleKey : openaiKey;
    const ratio = String(project.ratio || "9:16");

    // 크레딧 모드: 로그인 + 서버 키가 있으면 서버 키로 편집하고 성공 시 1크레딧 차감.
    const user = await getUserFromRequest(request);
    const serverKey = serverImageKeyFor(provider);
    const chargeCredits = Boolean(user && serverKey);
    const apiKey = chargeCredits ? serverKey : clientKey;

    if (!apiKey) {
      return NextResponse.json(
        { error: provider === "google" ? "Google Nano Banana 2 API 키가 필요합니다." : "OpenAI Image 2.0 API 키가 필요합니다." },
        { status: 400 }
      );
    }

    if (chargeCredits) {
      const profile = await getProfile(user!.id);
      if (profile.credits < 1) {
        return NextResponse.json(
          { error: `크레딧이 부족합니다. (필요 1, 보유 ${profile.credits}) 충전 후 이용해주세요.` },
          { status: 402 }
        );
      }
    }
    if (!image) {
      return NextResponse.json({ error: "수정할 섹션 이미지가 없습니다." }, { status: 400 });
    }
    if (!requestText.trim()) {
      return NextResponse.json({ error: "섹션 수정 요청사항을 입력해주세요." }, { status: 400 });
    }

    const prompt = [
      "너는 커머스 상세페이지 섹션 이미지 편집 엔진이다.",
      "첨부된 상세페이지 섹션 이미지를 기반으로 전체 톤과 제품 맥락은 유지하되, 사용자가 요청한 부분만 자연스럽게 편집한다.",
      ratioEditPromptInstruction(ratio),
      `프로젝트: ${project.title || "상세페이지 리디자인"}`,
      `판매 채널: ${project.channel || "스마트스토어"}`,
      `이 페이지 주제(내부 구분용, 화면에 절대 표기 금지): ${String(section.name || "").replace(/^S\d+\s*/, "").trim()}`,
      `섹션 목적: ${section.purpose || ""}`,
      `원본 참조: ${section.source || ""}`,
      `사용자 수정 요청: ${requestText}`,
      "섹션 코드/라벨 금지 규칙: 'S1', 'S2' 같은 섹션 코드나 '문제 공감', '히어로', 'POINT', 'SECTION' 같은 내부 구분용 이름·라벨을 이미지 안 어디에도(배지, 말머리, 제목, 태그, 워터마크) 절대 렌더링하지 않는다. 원본 이미지에 이런 코드/라벨이 남아 있으면 편집 과정에서 제거한다.",
      "브랜드명 금지 규칙: 'phoenix detail page', 'Phoenix Detail Page', 'PHOENIX DETAIL PAGE', 'PD'는 서비스명 또는 도구명일 뿐이며 제품 브랜드가 아니다. 이 단어들을 이미지 안의 제품명, 브랜드명, 로고, 라벨, 헤드라인, 후기, FAQ, CTA, 패키지 텍스트로 절대 사용하지 않는다.",
      "브랜드 사용 규칙: 제품 브랜드명과 제품명은 첨부 이미지 또는 프로젝트 원본에서 확인되는 이름만 사용한다. 확인되지 않는 새 브랜드명, 새 제품명, 새 로고를 만들지 않는다.",
      "편집 규칙: 제품명, 패키지, 핵심 수치, 안전 표현, 원본의 중요한 정보는 유지한다. 근거 없는 성능, 리뷰, 인증, 수치를 새로 만들지 않는다. 한국어 문구는 짧고 명확하게 정리하고, 작은 글씨는 줄인다."
    ].join("\n");

    const edited = provider === "google"
      ? await editWithGoogle({ apiKey, prompt, image })
      : await editWithOpenAI({ apiKey, prompt, image, ratio });

    // 성공한 편집에만 1크레딧 차감. 실패분은 청구하지 않는다.
    let creditsRemaining: number | null = null;
    if (chargeCredits) {
      try {
        creditsRemaining = await applyCredits(user!.id, -1, "섹션 부분 편집 1장", "image", String(section.id || ""));
      } catch (error) {
        console.error("[edit-section] credit charge failed", error);
      }
    }

    return NextResponse.json({
      imageUrl: `data:${edited.mimeType};base64,${edited.buffer.toString("base64")}`,
      mimeType: edited.mimeType,
      prompt,
      warning: edited.fallbackNotice || "",
      creditMode: chargeCredits,
      creditsRemaining
    });
  } catch (error) {
    console.error("[api/edit-section]", error);
    return NextResponse.json({ error: error instanceof Error ? humanizeProviderError(error.message) : "섹션 수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

async function editWithOpenAI({
  apiKey,
  prompt,
  image,
  ratio
}: {
  apiKey: string;
  prompt: string;
  image: { mimeType: string; buffer: Buffer };
  ratio: string;
}): Promise<EditedImage> {
  try {
    return await editWithOpenAIQuality({
      apiKey,
      prompt,
      image,
      ratio,
      quality: OPENAI_IMAGE_QUALITY,
      timeoutMs: OPENAI_IMAGE_HIGH_TIMEOUT_MS
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!shouldFallbackOpenAIQuality(message) || OPENAI_IMAGE_QUALITY === OPENAI_IMAGE_FALLBACK_QUALITY) {
      throw error;
    }

    const fallbackNotice = "OpenAI Image 2.0 high 품질 응답이 지연되어 모델 설정을 medium 품질로 자동 변경해 편집했습니다.";
    console.warn(`[edit-section] OpenAI quality fallback ${OPENAI_IMAGE_QUALITY} -> ${OPENAI_IMAGE_FALLBACK_QUALITY}: ${message}`);
    const fallbackImage = await editWithOpenAIQuality({
      apiKey,
      prompt,
      image,
      ratio,
      quality: OPENAI_IMAGE_FALLBACK_QUALITY,
      timeoutMs: OPENAI_IMAGE_FALLBACK_TIMEOUT_MS
    });
    return { ...fallbackImage, fallbackNotice };
  }
}

async function editWithOpenAIQuality({
  apiKey,
  prompt,
  image,
  ratio,
  quality,
  timeoutMs
}: {
  apiKey: string;
  prompt: string;
  image: { mimeType: string; buffer: Buffer };
  ratio: string;
  quality: string;
  timeoutMs: number;
}): Promise<EditedImage> {
  const form = new FormData();
  form.append("model", OPENAI_IMAGE_MODEL);
  form.append("prompt", prompt);
  form.append("size", openAIImageSizeForRatio(ratio));
  form.append("quality", quality);
  form.append("output_format", "png");
  form.append("stream", "true");
  form.append("partial_images", OPENAI_IMAGE_PARTIAL_IMAGES);
  form.append("image[]", new Blob([new Uint8Array(image.buffer)], { type: image.mimeType }), "section.png");

  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/images/edits",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    },
    timeoutMs,
    `OpenAI Image 2.0 ${quality} 품질 요청이 ${Math.round(timeoutMs / 1000)}초를 넘었습니다.`
  );

  const imageBase64 = await readOpenAIImageResponse(response, "OpenAI Image 2.0 섹션 수정 실패");
  if (!imageBase64) throw new Error("OpenAI 응답에 이미지 데이터가 없습니다.");
  return { mimeType: "image/png", buffer: Buffer.from(imageBase64, "base64") };
}

async function editWithGoogle({
  apiKey,
  prompt,
  image
}: {
  apiKey: string;
  prompt: string;
  image: { mimeType: string; buffer: Buffer };
}): Promise<EditedImage> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_NANO_BANANA_2_MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: image.mimeType, data: image.buffer.toString("base64") } }
        ]
      }]
    })
  });

  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(withRequestId(data?.error?.message || "Google Nano Banana 2 섹션 수정 실패", response));
  const imagePart = data?.candidates?.[0]?.content?.parts?.find((part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData);
  if (!imagePart?.inlineData?.data) throw new Error("Google 응답에 이미지 데이터가 없습니다.");
  return {
    mimeType: imagePart.inlineData.mimeType || "image/png",
    buffer: Buffer.from(imagePart.inlineData.data, "base64")
  };
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: simplifyProviderTextError(text || response.statusText, response.status) } };
  }
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number, timeoutMessage: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (isAbortLikeError(error)) throw new Error(timeoutMessage);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readOpenAIImageResponse(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const data = await readJsonResponse(response);
    throw new Error(withRequestId(data?.error?.message || fallbackMessage, response));
  }

  if (contentType.includes("text/event-stream")) {
    return readOpenAIImageStream(response);
  }

  const data = await readJsonResponse(response);
  return data?.data?.[0]?.b64_json || "";
}

async function readOpenAIImageStream(response: Response) {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let imageBase64 = "";

  const consumeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;

    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    try {
      const event = JSON.parse(payload);
      imageBase64 = event.b64_json || event.data?.[0]?.b64_json || imageBase64;
    } catch {
      // Non-JSON SSE lines are metadata; the final image arrives as JSON.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) consumeLine(line);
  }

  if (buffer) consumeLine(buffer);
  return imageBase64;
}

function withRequestId(message: string, response: Response) {
  const requestId = response.headers.get("x-request-id");
  return requestId ? `${message} (request_id: ${requestId})` : message;
}

function humanizeProviderError(message: string) {
  if (isTimeoutHtmlError(message)) {
    return "OpenAI 이미지 편집 응답 시간이 초과되었습니다. 업로드 이미지를 더 작게 줄이거나 잠시 후 다시 시도해주세요.";
  }
  if (message.includes("Incorrect API key provided")) {
    return "OpenAI API 키가 올바르지 않습니다. API 키 설정에서 최신 키를 다시 입력해주세요.";
  }
  if (message.includes("invalid_api_key")) {
    return "API 키가 올바르지 않습니다. 선택한 이미지 생성 모델에 맞는 API 키를 다시 입력해주세요.";
  }
  if (message.includes("must be verified") && message.includes("gpt-image")) {
    return "OpenAI Image 2.0 사용 권한이 아직 없습니다. OpenAI 조직 인증을 완료한 뒤 다시 시도해주세요.";
  }
  return message;
}

function simplifyProviderTextError(message: string, status: number) {
  if (isTimeoutHtmlError(message)) {
    return "OpenAI 이미지 편집 응답 시간이 초과되었습니다. 업로드 이미지를 더 작게 줄이거나 잠시 후 다시 시도해주세요.";
  }
  if (status === 504 || status === 524 || status === 408) {
    return "이미지 편집 응답 시간이 초과되었습니다. 잠시 후 다시 시도하거나 업로드 이미지 크기를 줄여주세요.";
  }
  return message;
}

function isTimeoutHtmlError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("<html") ||
    normalized.includes("inactivity timeout") ||
    normalized.includes("too much time has passed without sending any data") ||
    normalized.includes("gateway timeout")
  );
}

function isAbortLikeError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function shouldFallbackOpenAIQuality(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("incorrect api key") ||
    normalized.includes("invalid_api_key") ||
    normalized.includes("must be verified") ||
    normalized.includes("content_policy") ||
    normalized.includes("invalid image") ||
    normalized.includes("unsupported")
  ) {
    return false;
  }

  return (
    isTimeoutHtmlError(message) ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("rate limit") ||
    normalized.includes("server_error") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("overloaded") ||
    normalized.includes("upstream") ||
    normalized.includes("openai 응답에 이미지 데이터가 없습니다")
  );
}
