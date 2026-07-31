// 크레딧 상품표 — 금액·크레딧 수량의 단일 출처(서버 기준).
// 클라이언트가 보낸 금액은 절대 믿지 않고, 반드시 이 표와 대조한다.

export type Plan = {
  id: string;
  name: string;
  credits: number;
  amount: number; // KRW
  description: string;
};

export const PLANS: Plan[] = [
  { id: "starter", name: "스타터", credits: 30, amount: 19000, description: "가볍게 시작하는 30장" },
  { id: "basic", name: "베이직", credits: 100, amount: 55000, description: "가장 많이 선택하는 100장" },
  { id: "pro", name: "프로", credits: 300, amount: 149000, description: "운영자를 위한 300장" }
];

export function findPlan(planId: string): Plan | null {
  return PLANS.find((plan) => plan.id === planId) ?? null;
}

// 소모 기준(참고): 이미지 생성·편집 1장 = 1크레딧.
// 영상(Phase 7): 모션 1 / 홍보영상 720p 8 / 1080p 18 — motion 라우트에서 사용.
export const CREDIT_COSTS = {
  image: 1,
  motion: 1,
  promo720: 8,
  promo1080: 18
} as const;
