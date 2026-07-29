"use client";

import * as React from "react";
import Link from "next/link";
import { isCloudEnabled, signInWithGoogle, onAuthChange } from "@/lib/cloud-sync";

type GateState = "checking" | "authed" | "anon";

// 입구 게이트: Google 로그인 전에는 스튜디오에 진입할 수 없다.
// 클라우드(로그인)가 설정되지 않은 환경에서는 게이트를 우회해 기존처럼 바로 진입한다.
export function StudioGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<GateState>(isCloudEnabled() ? "checking" : "authed");
  const [signingIn, setSigningIn] = React.useState(false);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    if (!isCloudEnabled()) return;
    const hasOAuthCode = window.location.search.includes("code=");
    const fallback = hasOAuthCode
      ? window.setTimeout(() => setState((current) => (current === "checking" ? "anon" : current)), 8000)
      : 0;
    const unsubscribe = onAuthChange((user) => {
      if (user) {
        setState("authed");
      } else if (!hasOAuthCode) {
        setState("anon");
      }
    });
    return () => {
      if (fallback) window.clearTimeout(fallback);
      unsubscribe();
    };
  }, []);

  async function startSignIn() {
    setSigningIn(true);
    setMessage("");
    try {
      await signInWithGoogle();
    } catch (error) {
      setSigningIn(false);
      setMessage(error instanceof Error ? error.message : "Google 로그인을 시작하지 못했습니다.");
    }
  }

  if (state === "authed") return <>{children}</>;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f4ef] px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border border-black/8 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="grid justify-items-center gap-3 text-center">
          <div>
            <div className="text-2xl font-extrabold tracking-tight">
              <span className="text-[#ff6f61]">RENO</span><span className="text-black">ABLE</span>
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Detail Page Maker</div>
          </div>
          <p className="text-sm leading-relaxed text-neutral-600">
            기존 상세페이지 이미지를 분석해 구매전환 중심으로 리디자인하는 서비스입니다.
            Google 계정으로 로그인하면 바로 시작할 수 있습니다.
          </p>

          {state === "checking" ? (
            <div className="mt-2 flex min-h-11 items-center justify-center text-sm text-neutral-500">
              로그인 상태를 확인하는 중...
            </div>
          ) : (
            <button
              type="button"
              onClick={startSignIn}
              disabled={signingIn || !isCloudEnabled()}
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1a1a1a] px-5 text-sm font-bold text-white transition hover:bg-black disabled:opacity-60"
            >
              {signingIn ? "Google로 이동 중..." : "Google로 시작하기"}
            </button>
          )}

          {message ? <p className="text-xs text-red-600">{message}</p> : null}
          {!isCloudEnabled() ? (
            <p className="text-xs text-neutral-400">로그인 설정이 완료되지 않은 환경입니다. 관리자에게 문의해 주세요.</p>
          ) : null}

          <ul className="mt-3 w-full space-y-1 rounded-lg bg-neutral-50 p-3 text-left text-xs leading-relaxed text-neutral-500">
            <li>· 이미지 생성에는 본인의 OpenAI 또는 Google API 키가 필요합니다</li>
            <li>· 로그인하면 만든 작업을 클라우드에 저장하고 기기 간에 불러올 수 있습니다</li>
          </ul>

          <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
            로그인하면 <Link href="/terms" className="underline underline-offset-2 hover:text-neutral-600">이용약관</Link>과{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-neutral-600">개인정보처리방침</Link>에
            동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </main>
  );
}
