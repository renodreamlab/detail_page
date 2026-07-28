import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const PRIMARY_COMMENT_MODEL = process.env.OPENAI_COMMENT_MODEL || "gpt-5.4-nano";
const FALLBACK_COMMENT_MODEL = process.env.OPENAI_COMMENT_FALLBACK_MODEL || "gpt-5.4-mini";
const COMMENT_TIMEOUT_MS = Number(process.env.OPENAI_COMMENT_TIMEOUT_MS || 30000);

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  error?: { message?: string };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = String(body.openaiKey || "");
    const presetLabel = String(body.presetLabel || "");
    const presetText = String(body.presetText || "");
    const projectTitle = String(body.projectTitle || "");
    const section = body.section || {};

    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 400 });
    }

    if (!presetLabel || !presetText) {
      return NextResponse.json({ error: "AI 멘트 생성 메뉴 정보가 없습니다." }, { status: 400 });
    }

    const prompt = buildCommentPrompt({
      presetLabel,
      presetText,
      projectTitle,
      section
    });

    const result = await createCommentWithFallback({ apiKey, prompt });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI 멘트 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

function buildCommentPrompt({
  presetLabel,
  presetText,
  projectTitle,
  section
}: {
  presetLabel: string;
  presetText: string;
  projectTitle: string;
  section: Record<string, unknown>;
}) {
  return [
    "너는 한국 커머스 상세페이지를 개선하는 전문 카피라이터다.",
    "아래 메뉴의 기본 편집 의도를 유지하면서, 이미지 편집 요청창에 바로 넣을 수 있는 한국어 멘트를 생성해라.",
    "조건:",
    "- 2~4문장으로 작성한다.",
    "- 이미지 생성/편집 모델이 이해하기 쉽게 구체적으로 쓴다.",
    "- 근거 없는 리뷰, 수치, 인증, 효능은 새로 만들지 않는다.",
    "- 원본에 있는 정보만 강화하고, 안전한 표현을 사용한다.",
    "- 결과는 설명 없이 멘트만 출력한다.",
    "",
    `프로젝트: ${projectTitle || "상세페이지 프로젝트"}`,
    `섹션명: ${String(section.name || "")}`,
    `섹션 목적: ${String(section.purpose || "")}`,
    `원본 참조: ${String(section.source || "")}`,
    `기존 프롬프트: ${String(section.prompt || "").slice(0, 1200)}`,
    `선택 메뉴: ${presetLabel}`,
    `기본 편집 의도: ${presetText}`
  ].join("\n");
}

async function createCommentWithFallback({ apiKey, prompt }: { apiKey: string; prompt: string }) {
  const primary = await requestOpenAIComment({ apiKey, prompt, model: PRIMARY_COMMENT_MODEL });
  if (primary.ok) return primary.data;

  const message = primary.error || "AI 멘트 생성에 실패했습니다.";
  if (!isModelUnavailable(message) || PRIMARY_COMMENT_MODEL === FALLBACK_COMMENT_MODEL) {
    throw new Error(message);
  }

  const fallback = await requestOpenAIComment({ apiKey, prompt, model: FALLBACK_COMMENT_MODEL });
  if (!fallback.ok) {
    throw new Error(fallback.error || "AI 멘트 생성에 실패했습니다.");
  }

  return {
    ...fallback.data,
    notice: `${PRIMARY_COMMENT_MODEL} 모델을 사용할 수 없어 ${FALLBACK_COMMENT_MODEL}로 생성했습니다.`
  };
}

async function requestOpenAIComment({
  apiKey,
  prompt,
  model
}: {
  apiKey: string;
  prompt: string;
  model: string;
}): Promise<{ ok: true; data: { comment: string; model: string } } | { ok: false; error: string }> {
  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }]
      })
    },
    COMMENT_TIMEOUT_MS,
    `AI 멘트 생성 요청이 ${Math.round(COMMENT_TIMEOUT_MS / 1000)}초를 넘었습니다.`
  );

  const data = await readJsonResponse(response);
  if (!response.ok) {
    return { ok: false, error: data?.error?.message || "AI 멘트 생성에 실패했습니다." };
  }

  const comment = String(data.output_text || extractOpenAIText(data)).trim();
  if (!comment) {
    return { ok: false, error: "AI 멘트 응답이 비어 있습니다." };
  }

  return { ok: true, data: { comment, model } };
}

function isModelUnavailable(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("does not exist") ||
    normalized.includes("model_not_found") ||
    normalized.includes("not found") ||
    normalized.includes("access to model")
  );
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, timeoutMessage: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(timeoutMessage)), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(timeoutMessage);
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonResponse(response: Response): Promise<OpenAIResponse> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as OpenAIResponse;
  } catch {
    return { error: { message: text.slice(0, 500) } };
  }
}

function extractOpenAIText(data: OpenAIResponse) {
  return data.output
    ?.flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("\n")
    .trim() || "";
}
