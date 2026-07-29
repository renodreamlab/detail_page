import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

type CloudProjectRow = {
  id?: string;
  user_id?: string;
  local_id: string;
  title: string;
  channel?: string | null;
  ratio?: string | null;
  model?: string | null;
  request?: string | null;
  sections?: unknown[];
  created_at?: string;
  updated_at?: string;
};

let _client: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true
    }
  });
  return _client;
}

export function isCloudEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function signInWithGoogle(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` }
  });
}

export async function exchangeCode(code: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.exchangeCodeForSession(code);
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

export async function getCurrentUser(): Promise<User | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function upsertProject(project: CloudProjectRow): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const user = await getCurrentUser();
  if (!user) return;
  await sb.from("projects").upsert(
    { ...project, user_id: user.id },
    { onConflict: "user_id,local_id" }
  );
}

export async function listCloudProjects(): Promise<CloudProjectRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("projects")
    .select("id, local_id, title, channel, ratio, model, request, created_at, updated_at")
    .order("updated_at", { ascending: false });
  return data ?? [];
}

export async function loadCloudProject(localId: string): Promise<CloudProjectRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from("projects").select("*").eq("local_id", localId).single();
  return data;
}

export async function renameCloudProject(localId: string, title: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const user = await getCurrentUser();
  if (!user) return;
  await sb
    .from("projects")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("local_id", localId)
    .eq("user_id", user.id);
}

export async function deleteCloudProject(localId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("projects").delete().eq("local_id", localId);
}

// 업로드 원본을 Supabase Storage로 직접 올려 Vercel 요청 본문 한도(4.5MB)를 우회한다.
// 실패 시 null을 반환해 호출부가 기존 직접 전송 방식으로 폴백할 수 있게 한다.
export async function uploadReferenceFilesToStorage(files: File[]): Promise<string[] | null> {
  const supabase = getSupabase();
  if (!supabase || files.length === 0) return null;

  try {
    const response = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: files.map((file) => ({ name: file.name, type: file.type, size: file.size })) })
    });
    if (!response.ok) return null;

    const data = await response.json();
    const uploads = data?.uploads;
    if (!Array.isArray(uploads) || uploads.length !== files.length) return null;

    for (let index = 0; index < files.length; index += 1) {
      const { path, token } = uploads[index] || {};
      if (!path || !token) return null;
      const { error } = await supabase.storage
        .from("uploads")
        .uploadToSignedUrl(path, token, files[index], { contentType: files[index].type || "image/jpeg" });
      if (error) return null;
    }
    return uploads.map((upload: { path: string }) => upload.path);
  } catch {
    return null;
  }
}
