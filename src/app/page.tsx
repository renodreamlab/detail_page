import Image from "next/image";
import Link from "next/link";

export default function Page() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080d18] text-white">
      <Image
        src="/main-page-image.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-contain opacity-72"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,13,24,0.72),rgba(8,13,24,0.18)_42%,rgba(8,13,24,0.84))]" />

      <header className="relative z-10 flex h-20 items-center justify-between px-6 max-sm:h-16 max-sm:px-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-12 place-items-center overflow-hidden rounded-md border border-white/15 bg-white/90">
            <Image src="/phoenix-ai-logo.png" alt="Phoenix AI" width={44} height={44} className="object-contain" />
          </span>
          <span className="text-base font-semibold tracking-normal">PhoenixAI</span>
        </Link>
      </header>

      <section className="relative z-10 grid min-h-[calc(100vh-9rem)] place-items-center px-5 py-12 text-center">
        <div className="grid justify-items-center gap-4">
          <Link
            href="/studio"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#ff6f61] px-5 text-xs font-black text-white shadow-[0_18px_45px_rgba(255,111,97,0.34)] transition hover:bg-[#ff806f]"
          >
            phoenix detail page 입장
          </Link>
        </div>
      </section>

      <footer className="relative z-10 flex min-h-16 items-center justify-center border-t border-white/10 px-4 text-xs font-semibold text-white/68">
        PhoenixAI
      </footer>
    </main>
  );
}
