"use client";

import * as React from "react";
import Link from "next/link";
import { getAccessToken, isCloudEnabled, onAuthChange, signInWithGoogle } from "@/lib/cloud-sync";
import { type User } from "@supabase/supabase-js";

type Tab = "bank" | "members" | "invites";

type BankRequest = {
  id: string;
  user_email: string | null;
  plan_id: string;
  amount: number;
  credits: number;
  depositor_name: string;
  status: string;
  admin_memo: string | null;
  created_at: string;
};

type Member = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  credits: number;
};

async function adminFetch(path: string, init?: RequestInit) {
  const token = await getAccessToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `요청 실패 (${response.status})`);
  return data;
}

// 관리자 콘솔: 무통장 승인 / 회원 관리 / 수강생 코드(Phase 6).
// 모든 데이터 접근은 서버 admin 라우트를 거치며 ADMIN_EMAILS로 검사된다.
export default function AdminPage() {
  const [user, setUser] = React.useState<User | null>(null);
  const [authChecked, setAuthChecked] = React.useState(!isCloudEnabled());
  const [tab, setTab] = React.useState<Tab>("bank");
  const [denied, setDenied] = React.useState(false);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    if (!isCloudEnabled()) return;
    return onAuthChange((nextUser) => {
      setUser(nextUser);
      setAuthChecked(true);
    });
  }, []);

  React.useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!authChecked) {
    return <AdminShell><p className="text-sm text-neutral-500">로그인 상태를 확인하는 중...</p></AdminShell>;
  }

  if (!user) {
    return (
      <AdminShell>
        <p className="text-sm text-neutral-600">관리자 콘솔은 로그인 후 이용할 수 있습니다.</p>
        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-[#1a1a1a] px-5 text-sm font-bold text-white"
        >
          Google로 로그인
        </button>
      </AdminShell>
    );
  }

  if (denied) {
    return (
      <AdminShell>
        <p className="text-sm font-semibold text-red-600">관리자 권한이 없는 계정입니다. ({user.email})</p>
        <Link href="/studio" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-5 text-sm font-bold text-neutral-700">
          제작실로 돌아가기
        </Link>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-5 flex gap-2">
        {([
          ["bank", "무통장 입금 승인"],
          ["members", "회원 관리"],
          ["invites", "수강생 코드"]
        ] as Array<[Tab, string]>).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? "inline-flex min-h-10 items-center rounded-md bg-[#1a1a1a] px-4 text-sm font-bold text-white"
                : "inline-flex min-h-10 items-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-600 hover:border-neutral-500"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "bank" ? <BankTab onDenied={() => setDenied(true)} onMessage={setMessage} /> : null}
      {tab === "members" ? <MembersTab onDenied={() => setDenied(true)} onMessage={setMessage} /> : null}
      {tab === "invites" ? (
        <p className="text-sm text-neutral-500">수강생 초대 코드는 다음 단계(Phase 6)에서 활성화됩니다.</p>
      ) : null}

      {message ? (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-md bg-neutral-900 px-4 py-3 text-sm text-white shadow-xl">{message}</div>
      ) : null}
    </AdminShell>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f4ef] px-5 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 flex items-center justify-between">
          <div className="text-xl font-extrabold tracking-tight">
            <span className="text-[#ff6f61]">RENO</span><span className="text-black">ABLE</span>
            <span className="ml-2 rounded bg-neutral-900 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-white">Admin</span>
          </div>
          <Link
            href="/studio"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-700 transition hover:border-neutral-500"
          >
            제작실로 이동
          </Link>
        </header>
        {children}
      </div>
    </main>
  );
}

function BankTab({ onDenied, onMessage }: { onDenied: () => void; onMessage: (message: string) => void }) {
  const [requests, setRequests] = React.useState<BankRequest[]>([]);
  const [status, setStatus] = React.useState("pending");
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  // window.confirm/prompt는 환경에 따라 차단되므로 인라인 확인 UI를 쓴다.
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [rejectMemo, setRejectMemo] = React.useState("");

  const load = React.useCallback(async (nextStatus: string) => {
    setLoading(true);
    try {
      const data = await adminFetch(`/api/admin/bank-transfers?status=${nextStatus}`);
      setRequests(data.requests || []);
    } catch (error) {
      if (error instanceof Error && error.message.includes("관리자 권한")) onDenied();
      else onMessage(error instanceof Error ? error.message : "목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [onDenied, onMessage]);

  React.useEffect(() => {
    load(status);
  }, [status, load]);

  async function decide(request: BankRequest, action: "approve" | "reject", memo = "") {
    setBusyId(request.id);
    try {
      const data = await adminFetch("/api/admin/bank-transfers", {
        method: "POST",
        body: JSON.stringify({ requestId: request.id, action, memo })
      });
      onMessage(action === "approve" ? `승인 완료. 지급 후 잔액 ${data.balance}크레딧` : "거절 처리했습니다.");
      setConfirmId(null);
      setRejectingId(null);
      setRejectMemo("");
      load(status);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "처리 실패");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {["pending", "approved", "rejected", "all"].map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setStatus(candidate)}
              className={
                status === candidate
                  ? "rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-bold text-white"
                  : "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-500"
              }
            >
              {candidate === "pending" ? "대기" : candidate === "approved" ? "승인됨" : candidate === "rejected" ? "거절됨" : "전체"}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => load(status)} className="text-xs font-bold text-neutral-500 underline underline-offset-2">
          새로고침
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-neutral-500">불러오는 중...</p>
      ) : requests.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">표시할 신청이 없습니다.</p>
      ) : (
        requests.map((request) => (
          <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/8 bg-white p-4 shadow-sm max-md:flex-col max-md:items-stretch">
            <div className="min-w-0">
              <div className="text-sm font-bold">
                {request.depositor_name}
                <span className="ml-2 font-semibold text-neutral-500">{request.user_email}</span>
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {request.plan_id} · {request.amount.toLocaleString()}원 · {request.credits}크레딧 ·{" "}
                {new Date(request.created_at).toLocaleString("ko-KR")}
                {request.admin_memo ? <> · 메모: {request.admin_memo}</> : null}
              </div>
            </div>
            {request.status === "pending" ? (
              rejectingId === request.id ? (
                <div className="flex shrink-0 items-center gap-2 max-md:flex-wrap">
                  <input
                    autoFocus
                    value={rejectMemo}
                    onChange={(event) => setRejectMemo(event.target.value)}
                    placeholder="거절 사유 (메모)"
                    className="min-h-10 w-44 rounded-md border border-neutral-300 px-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={busyId === request.id}
                    onClick={() => decide(request, "reject", rejectMemo.trim())}
                    className="inline-flex min-h-10 items-center rounded-md bg-red-600 px-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    거절 확정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingId(null);
                      setRejectMemo("");
                    }}
                    className="inline-flex min-h-10 items-center rounded-md border border-neutral-300 px-3 text-sm font-bold text-neutral-600"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busyId === request.id}
                    onClick={() => {
                      if (confirmId === request.id) decide(request, "approve");
                      else setConfirmId(request.id);
                    }}
                    className={
                      confirmId === request.id
                        ? "inline-flex min-h-10 items-center rounded-md bg-[#0b7a70] px-4 text-sm font-bold text-white ring-2 ring-[#0d9488]/40 disabled:opacity-60"
                        : "inline-flex min-h-10 items-center rounded-md bg-[#0d9488] px-4 text-sm font-bold text-white disabled:opacity-60"
                    }
                  >
                    {busyId === request.id ? "처리 중..." : confirmId === request.id ? `${request.credits}크레딧 지급 확정` : "승인"}
                  </button>
                  {confirmId === request.id ? (
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="inline-flex min-h-10 items-center rounded-md border border-neutral-300 px-3 text-sm font-bold text-neutral-600"
                    >
                      취소
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === request.id}
                      onClick={() => {
                        setRejectingId(request.id);
                        setConfirmId(null);
                      }}
                      className="inline-flex min-h-10 items-center rounded-md border border-red-300 px-4 text-sm font-bold text-red-600 disabled:opacity-60"
                    >
                      거절
                    </button>
                  )}
                </div>
              )
            ) : (
              <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${request.status === "approved" ? "bg-teal-50 text-teal-700" : "bg-red-50 text-red-600"}`}>
                {request.status === "approved" ? "승인됨" : "거절됨"}
              </span>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function MembersTab({ onDenied, onMessage }: { onDenied: () => void; onMessage: (message: string) => void }) {
  const [email, setEmail] = React.useState("");
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  // window.prompt는 환경에 따라 차단되므로 인라인 폼을 쓴다.
  const [adjusting, setAdjusting] = React.useState<{ id: string; sign: 1 | -1 } | null>(null);
  const [adjustAmount, setAdjustAmount] = React.useState("10");
  const [adjustReason, setAdjustReason] = React.useState("");

  const search = React.useCallback(async (query: string) => {
    setLoading(true);
    try {
      const data = await adminFetch(`/api/admin/members?email=${encodeURIComponent(query)}`);
      setMembers(data.members || []);
    } catch (error) {
      if (error instanceof Error && error.message.includes("관리자 권한")) onDenied();
      else onMessage(error instanceof Error ? error.message : "검색 실패");
    } finally {
      setLoading(false);
    }
  }, [onDenied, onMessage]);

  React.useEffect(() => {
    search("");
  }, [search]);

  async function submitAdjust(member: Member) {
    if (!adjusting) return;
    const label = adjusting.sign > 0 ? "지급" : "회수";
    const amount = Math.abs(parseInt(adjustAmount, 10));
    if (!Number.isInteger(amount) || amount <= 0) {
      onMessage("1 이상의 정수를 입력해주세요.");
      return;
    }
    const reason = adjustReason.trim();
    if (!reason) {
      onMessage("사유는 필수입니다. (장부에 기록됩니다)");
      return;
    }

    setBusyId(member.id);
    try {
      const data = await adminFetch("/api/admin/members", {
        method: "POST",
        body: JSON.stringify({ userId: member.id, delta: adjusting.sign * amount, reason })
      });
      onMessage(`${label} 완료. 잔액 ${data.balance}크레딧`);
      setAdjusting(null);
      setAdjustReason("");
      search(email);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "처리 실패");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          search(email);
        }}
      >
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="이메일로 검색 (비우면 전체)"
          className="min-h-11 flex-1 rounded-md border border-neutral-300 bg-white px-3 text-sm"
        />
        <button type="submit" className="inline-flex min-h-11 items-center rounded-md bg-[#1a1a1a] px-5 text-sm font-bold text-white">
          검색
        </button>
      </form>

      {loading ? (
        <p className="py-8 text-center text-sm text-neutral-500">불러오는 중...</p>
      ) : members.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">검색 결과가 없습니다.</p>
      ) : (
        members.map((member) => (
          <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/8 bg-white p-4 shadow-sm max-md:flex-col max-md:items-stretch">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{member.email}</div>
              <div className="mt-1 text-xs text-neutral-500">
                가입 {new Date(member.created_at).toLocaleDateString("ko-KR")}
                {member.last_sign_in_at ? <> · 최근 로그인 {new Date(member.last_sign_in_at).toLocaleDateString("ko-KR")}</> : null}
              </div>
            </div>
            {adjusting?.id === member.id ? (
              <div className="flex shrink-0 items-center gap-2 max-md:flex-wrap">
                <span className="text-xs font-bold text-neutral-500">{adjusting.sign > 0 ? "지급" : "회수"}</span>
                <input
                  autoFocus
                  value={adjustAmount}
                  onChange={(event) => setAdjustAmount(event.target.value)}
                  inputMode="numeric"
                  placeholder="수량"
                  className="min-h-10 w-16 rounded-md border border-neutral-300 px-2 text-sm"
                />
                <input
                  value={adjustReason}
                  onChange={(event) => setAdjustReason(event.target.value)}
                  placeholder="사유 (필수, 장부 기록)"
                  className="min-h-10 w-44 rounded-md border border-neutral-300 px-2 text-sm"
                />
                <button
                  type="button"
                  disabled={busyId === member.id}
                  onClick={() => submitAdjust(member)}
                  className={`inline-flex min-h-10 items-center rounded-md px-3 text-sm font-bold text-white disabled:opacity-60 ${adjusting.sign > 0 ? "bg-[#0d9488]" : "bg-red-600"}`}
                >
                  {busyId === member.id ? "처리 중..." : "확정"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjusting(null);
                    setAdjustReason("");
                  }}
                  className="inline-flex min-h-10 items-center rounded-md border border-neutral-300 px-3 text-sm font-bold text-neutral-600"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-md bg-neutral-100 px-2.5 py-1 text-sm font-extrabold">{member.credits}개</span>
                <button
                  type="button"
                  disabled={busyId === member.id}
                  onClick={() => {
                    setAdjusting({ id: member.id, sign: 1 });
                    setAdjustAmount("10");
                    setAdjustReason("");
                  }}
                  className="inline-flex min-h-10 items-center rounded-md bg-[#0d9488] px-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  지급
                </button>
                <button
                  type="button"
                  disabled={busyId === member.id}
                  onClick={() => {
                    setAdjusting({ id: member.id, sign: -1 });
                    setAdjustAmount("10");
                    setAdjustReason("");
                  }}
                  className="inline-flex min-h-10 items-center rounded-md border border-red-300 px-3 text-sm font-bold text-red-600 disabled:opacity-60"
                >
                  회수
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
