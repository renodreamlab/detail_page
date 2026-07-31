import Link from "next/link";
import { PricingPlans } from "@/components/pricing-plans";

export const metadata = {
  title: "크레딧 충전 — RENOABLE Detail Page Maker"
};

// 비로그인도 열람 가능한 공개 가격 페이지. 실제 결제는 로그인 후 진행된다.
export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#f6f4ef] px-5 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            <span className="text-[#ff6f61]">RENO</span><span className="text-black">ABLE</span>
            <span className="ml-2 text-sm font-medium text-neutral-500">Detail Page Maker</span>
          </Link>
          <Link
            href="/studio"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-700 transition hover:border-neutral-500"
          >
            제작실로 이동
          </Link>
        </header>

        <div className="mb-8 grid gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">크레딧 충전</h1>
          <p className="text-sm leading-relaxed text-neutral-600">
            이미지 생성·부분 편집 1장 = 1크레딧. 성공한 결과물에만 차감되며, 실패한 생성은 청구되지 않습니다.
          </p>
        </div>

        <PricingPlans />

        <p className="mt-8 text-[11px] leading-relaxed text-neutral-400">
          결제 관련 문의는 관리자에게 연락해주세요. 크레딧 환불 정책은{" "}
          <Link href="/terms" className="underline underline-offset-2">이용약관</Link>을 참고하세요.
        </p>
      </div>
    </main>
  );
}
