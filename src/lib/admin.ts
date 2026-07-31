import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/lib/credits";

// 관리자 판별: ADMIN_EMAILS(쉼표 구분)에 로그인 이메일이 있어야 한다.
// 모든 admin 라우트는 서버에서 이 검사를 통과해야 접근 가능.

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

export async function getAdminFromRequest(request: Request): Promise<User | null> {
  const user = await getUserFromRequest(request);
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

let _admin: SupabaseClient | null = null;

export function adminDbClient(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}
