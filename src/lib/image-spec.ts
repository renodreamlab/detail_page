export const RATIOS = { "9:16": 9 / 16, "4:5": 4 / 5, "1:1": 1 } as const;
export type RatioKey = keyof typeof RATIOS;

// gpt-image-2 지원 size 실측 전 기본값(1024x1792 미지원 가정). 실측 후 갱신.
export function openAIImageSizeForRatio(ratio: string): string {
  if (ratio === "1:1") return "1024x1024";
  return process.env.OPENAI_IMAGE_SIZE || "1024x1536";
}

// 캔버스 대비 목표 비율의 안전 영역 비율 계산 (size가 바뀌어도 자동 대응)
export function safeAreaForRatio(ratio: string, canvas = openAIImageSizeForRatio(ratio)) {
  const [w, h] = canvas.split("x").map(Number);
  const canvasRatio = w / h;
  const target = RATIOS[ratio as RatioKey] ?? 9 / 16;
  if (canvasRatio > target) {
    const widthPct = Math.floor((target / canvasRatio) * 100); // 9:16@2:3 → 84
    return { axis: "horizontal" as const, pct: widthPct };
  }
  if (canvasRatio < target) {
    const heightPct = Math.floor((canvasRatio / target) * 100); // 4:5@2:3 → 83
    return { axis: "vertical" as const, pct: heightPct };
  }
  return { axis: "none" as const, pct: 100 };
}

// 잘림 후 실제 노출 화면 기준, 콘텐츠가 차지할 최대 비율 (나머지는 빈 여백)
// 실측: 84% 안전영역만 지시하면 모델이 경계까지 채워 좌우가 꽉 차 보임 → "20% 여백" 프롬프트로 교정됐던 것을 수치로 고정
const CONTENT_FILL = 0.8;

function bleedRule(ratio: string): string {
  const sa = safeAreaForRatio(ratio);
  if (sa.axis === "horizontal") {
    const edgePct = Math.ceil((100 - sa.pct) / 2);
    const contentPct = Math.floor(sa.pct * CONTENT_FILL); // 9:16@2:3 → 67
    const sideMarginPct = Math.round((100 - CONTENT_FILL * 100) / 2); // → 10
    return [
      `[중요-레이아웃 규칙] 최종 출력은 캔버스 중앙 세로 기준 폭 ${sa.pct}% 영역만 사용된다(좌우 각 ${edgePct}%는 잘려나감).`,
      `텍스트·로고·번호·배지·아이콘은 물론 캐릭터, 일러스트, 다이어그램, 리본, 장식 요소까지 모든 시각 요소를 반드시 중앙 ${sa.pct}% 폭 안에 배치하라.`,
      "좌우 가장자리 영역에는 배경색·배경 패턴·그라데이션만 자연스럽게 연장하라(bleed). 어떤 글자나 그래픽도 이 여백에 걸치면 안 된다.",
      `[여백 규칙] 잘림 후 실제 노출되는 화면 기준으로 콘텐츠는 화면 폭의 약 ${Math.round(CONTENT_FILL * 100)}%만 사용하고, 좌우에 각각 화면 폭의 ${sideMarginPct}% 이상을 빈 여백으로 남겨라. 캔버스 기준으로는 텍스트와 그래픽을 중앙 ${contentPct}% 폭 안에 넣는다는 뜻이다(안전 영역 ${sa.pct}%보다 확실히 좁게). 화면 상하 가장자리에도 각각 5% 이상의 숨 쉴 여백을 남겨라.`,
      "[여백 일관성 규칙] 콘텐츠를 화면에 꽉 채우지 말고, 같은 시리즈의 다른 페이지들과 동일한 콘텐츠 폭으로 정돈되어 보이게 하라."
    ].join(" ");
  }
  if (sa.axis === "vertical") {
    const edgePct = Math.ceil((100 - sa.pct) / 2);
    const contentPct = Math.floor(sa.pct * CONTENT_FILL);
    const sideMarginPct = Math.round((100 - CONTENT_FILL * 100) / 2);
    return [
      `[중요-레이아웃 규칙] 최종 출력은 캔버스 중앙 가로 기준 높이 ${sa.pct}% 영역만 사용된다(상하 각 ${edgePct}%는 잘려나감).`,
      `텍스트는 물론 캐릭터, 일러스트, 다이어그램, 장식 요소까지 모든 시각 요소를 중앙 ${sa.pct}% 높이 안에 배치하고, 상하 가장자리에는 배경만 연장하라(bleed).`,
      `[여백 규칙] 잘림 후 실제 노출되는 화면 기준으로 콘텐츠는 화면 높이의 약 ${Math.round(CONTENT_FILL * 100)}%만 사용하고 상하에 각각 ${sideMarginPct}% 이상을 빈 여백으로 남겨라(캔버스 기준 중앙 ${contentPct}% 높이). 좌우 가장자리에도 각각 화면 폭의 5% 이상을 비워, 콘텐츠가 화면에 꽉 차 보이지 않게 하라.`,
      "[여백 일관성 규칙] 같은 시리즈의 다른 페이지들과 동일한 콘텐츠 폭으로 정돈되어 보이게 하라."
    ].join(" ");
  }
  return "";
}

// 잘림이 없는 비율(1:1 등)에도 적용하는 공통 여백 지시
const squareMarginRule =
  `[여백 규칙] 콘텐츠를 화면에 꽉 채우지 마라. 텍스트와 그래픽은 화면의 약 ${Math.round(CONTENT_FILL * 100)}%만 사용하고, 상하좌우 가장자리에 각각 화면의 10% 정도를 빈 여백으로 남겨 시원하게 배치하라.`;

// generate(신규 생성) 경로용 비율 지시문
export function ratioPromptInstruction(ratio: string): string {
  if (ratio === "1:1") {
    return "1:1 정사각형 이미지 1장을 생성한다. 썸네일, 카드뉴스, 보조 이미지에 맞게 제품과 핵심 혜택 1개가 중앙에서 빠르게 읽히도록 구성한다.\n" + squareMarginRule;
  }
  if (ratio === "4:5") {
    return "4:5 세로 피드형 이미지 1장을 생성한다. 광고/SNS 피드 소재에 맞게 제품 이미지와 짧은 카피를 여유 있게 배치하고, 9:16 상세페이지처럼 너무 길게 만들지 않는다.\n" + bleedRule(ratio);
  }
  return "9:16 세로형 상세페이지 섹션 이미지 1장을 생성한다. 모바일 상세페이지 본문에 맞게 위에서 아래로 읽히는 정보 흐름을 구성한다.\n" + bleedRule(ratio);
}

// edit-section(개별 수정) 경로용 비율 지시문
export function ratioEditPromptInstruction(ratio: string): string {
  if (ratio === "1:1") {
    return "RATIO_RULE: keep the edited image as a 1:1 square composition for thumbnails, card news, and supporting product images.\n" + squareMarginRule;
  }
  if (ratio === "4:5") {
    return "RATIO_RULE: keep the edited image as a 4:5 vertical feed composition for ads and social feed assets, not a long 9:16 detail page.\n" + bleedRule(ratio);
  }
  return "RATIO_RULE: keep the edited image as a 9:16 vertical detail-page section for mobile commerce detail pages.\n" + bleedRule(ratio);
}
