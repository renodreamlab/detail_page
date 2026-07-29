import Link from "next/link";

// 이용약관·개인정보처리방침 공용 레이아웃
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f4ef] px-5 py-10">
      <article className="mx-auto w-full max-w-2xl rounded-2xl border border-black/8 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.06)] max-sm:p-5">
        <header className="mb-6 border-b border-black/8 pb-5">
          <Link href="/" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-neutral-800">
            <span className="text-base font-extrabold tracking-tight">
              <span className="text-[#ff6f61]">RENO</span><span className="text-black">ABLE</span>
            </span>
            <span className="text-neutral-400">Detail Page Maker</span>
          </Link>
          <h1 className="text-2xl font-black tracking-tight">{title}</h1>
          <p className="mt-1 text-xs text-neutral-400">시행일: {updated}</p>
        </header>
        <div className="space-y-6 text-sm leading-relaxed text-neutral-700 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-neutral-900 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
        <footer className="mt-8 flex items-center justify-between border-t border-black/8 pt-5 text-xs text-neutral-400">
          <span>RENOABLE</span>
          <span className="flex gap-3">
            <Link href="/terms" className="hover:text-neutral-600">이용약관</Link>
            <Link href="/privacy" className="hover:text-neutral-600">개인정보처리방침</Link>
          </span>
        </footer>
      </article>
    </main>
  );
}
