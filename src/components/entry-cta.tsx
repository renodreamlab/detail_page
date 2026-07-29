"use client";

import * as React from "react";
import Link from "next/link";
import { isCloudEnabled, signInWithGoogle, onAuthChange } from "@/lib/cloud-sync";

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-[#ff6f61] px-5 text-xs font-black text-white shadow-[0_18px_45px_rgba(255,111,97,0.34)] transition hover:bg-[#ff806f] disabled:opacity-60";

// 랜딩 입장 버튼: 로그인 상태면 스튜디오로, 아니면 Google 로그인부터 시작한다.
// 클라우드(로그인)가 설정되지 않은 환경에서는 기존처럼 바로 입장 링크를 노출한다.
export function EntryCta() {
  const [authed, setAuthed] = React.useState<boolean | null>(isCloudEnabled() ? null : true);
  const [signingIn, setSigningIn] = React.useState(false);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    if (!isCloudEnabled()) return;
    return onAuthChange((user) => setAuthed(Boolean(user)));
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

  if (authed) {
    return (
      <Link href="/studio" className={buttonClass}>
        RENOABLE 입장
      </Link>
    );
  }

  return (
    <div className="grid justify-items-center gap-2">
      <button type="button" onClick={startSignIn} disabled={signingIn || authed === null} className={buttonClass}>
        {authed === null ? "확인 중..." : signingIn ? "Google로 이동 중..." : "Google로 시작하기"}
      </button>
      <p className="text-[11px] text-white/60">구글 계정으로 로그인 후 이용할 수 있습니다</p>
      {message ? <p className="text-[11px] text-red-300">{message}</p> : null}
    </div>
  );
}
