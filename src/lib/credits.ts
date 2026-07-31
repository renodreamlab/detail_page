import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

// 크레딧 서버 헬퍼: 요청의 로그인 사용자 확인 -> 프로필 조회 -> apply_credits RPC.
// 전부 service role로만 DB에 접근한다(클라이언트에서 직접 잔액 변경 불가).

let _admin: SupabaseClient | null = null;

function adminClient(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

// Authorization: Bearer <supabase access token> 헤더에서 로그인 사용자를 확인한다.
export async function getUserFromRequest(request: Request): Promise<User | null> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;
  const supabase = adminClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user ?? null;
}

export type Profile = {
  credits: number;
  account_type?: string;
};

export async function getProfile(userId: string): Promise<Profile> {
  const supabase = adminClient();
  if (!supabase) return { credits: 0 };
  const { data } = await supabase.from("profiles").select("credits").eq("id", userId).maybeSingle();
  return data ? { credits: Number(data.credits) || 0 } : { credits: 0 };
}

// 잔액 변경 + 장부 기록을 DB 함수에서 원자적으로 처리한다. 반환값은 변경 후 잔액.
export async function applyCredits(
  userId: string,
  delta: number,
  reason: string,
  refType?: string,
  refId?: string
): Promise<number> {
  const supabase = adminClient();
  if (!supabase) throw new Error("크레딧 저장소가 설정되지 않았습니다.");
  const { data, error } = await supabase.rpc("apply_credits", {
    p_user_id: userId,
    p_delta: delta,
    p_reason: reason,
    p_ref_type: refType ?? null,
    p_ref_id: refId ?? null
  });
  if (error) throw new Error(`크레딧 처리 실패: ${error.message}`);
  return Number(data);
}

export async function getRecentLedger(userId: string, limit = 20) {
  const supabase = adminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("credit_ledger")
    .select("delta, balance_after, reason, ref_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// 제공자별 서버 이미지 키. 있으면(그리고 로그인 상태면) 크레딧 차감 모드로 동작한다.
export function serverImageKeyFor(provider: "openai" | "google"): string {
  return provider === "google" ? process.env.GOOGLE_API_KEY || "" : process.env.OPENAI_API_KEY || "";
}
