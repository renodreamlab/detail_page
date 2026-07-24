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
  _client = createClient(url, key);
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
    options: { redirectTo: `${window.location.origin}/studio` }
  });
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

export async function deleteCloudProject(localId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("projects").delete().eq("local_id", localId);
}
