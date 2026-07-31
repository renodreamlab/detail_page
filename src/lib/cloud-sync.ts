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

export type CloudSection = {
  id?: string;
  name?: string;
  purpose?: string;
  source?: string;
  prompt?: string;
  imageUrl?: string;
  imagePath?: string;
  [key: string]: unknown;
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

  // 재저장 시 고아 파일 정리를 위해 기존 행의 이미지 경로를 먼저 확보한다.
  let previousPaths: string[] = [];
  try {
    const { data: existing } = await sb
      .from("projects")
      .select("sections")
      .eq("user_id", user.id)
      .eq("local_id", project.local_id)
      .maybeSingle();
    previousPaths = collectImagePaths(existing?.sections);
  } catch {
    previousPaths = [];
  }

  // 생성 이미지는 Storage에 올리고 DB에는 경로만 남긴다. 실패하면 base64 그대로 저장(폴백).
  const sections = Array.isArray(project.sections) ? (project.sections as CloudSection[]) : [];
  let payloadSections: CloudSection[];
  try {
    payloadSections = (await buildCloudSections(sections)) ?? stripLocalOnlyFields(sections);
  } catch {
    payloadSections = stripLocalOnlyFields(sections);
  }

  const { error } = await sb.from("projects").upsert(
    { ...project, sections: payloadSections, user_id: user.id, updated_at: new Date().toISOString() },
    { onConflict: "user_id,local_id" }
  );
  if (error) return;

  const nextPaths = new Set(collectImagePaths(payloadSections));
  const orphans = previousPaths.filter((path) => !nextPaths.has(path));
  if (orphans.length > 0) {
    deleteGeneratedImages(orphans).catch(() => {});
  }
}

// revisions(편집 히스토리)는 용량이 커서 클라우드 페이로드에서 항상 제외한다(로컬 전용).
function stripLocalOnlyFields(sections: CloudSection[]): CloudSection[] {
  return sections.map((section) => {
    const { revisions: _revisions, ...rest } = section as CloudSection & { revisions?: unknown };
    return rest;
  });
}

function collectImagePaths(sections: unknown): string[] {
  if (!Array.isArray(sections)) return [];
  return sections
    .map((section) => (section as CloudSection)?.imagePath)
    .filter((path): path is string => typeof path === "string" && path.startsWith("gen/"));
}

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, payload] = dataUrl.split(",");
  const mime = meta?.match(/^data:([^;]+)/)?.[1] || "image/png";
  const binary = atob(payload || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

// 클라우드 저장용 섹션 변환: base64 이미지를 generated 버킷에 올리고 경로만 남긴다.
// 하나라도 실패하면 null을 반환해 호출부가 base64 폴백을 쓰게 한다.
async function buildCloudSections(sections: CloudSection[]): Promise<CloudSection[] | null> {
  const stripped = stripLocalOnlyFields(sections);
  const pendingIndexes: number[] = [];
  const blobs: Blob[] = [];
  for (const [index, section] of stripped.entries()) {
    if (typeof section.imageUrl === "string" && section.imageUrl.startsWith("data:image/")) {
      pendingIndexes.push(index);
      blobs.push(dataUrlToBlob(section.imageUrl));
    }
  }

  const finalize = (list: CloudSection[]) =>
    list.map((section) => {
      if (!section.imagePath) return section;
      // 경로가 있으면 일시적인 서명 URL은 버린다(불러올 때 다시 서명).
      const { imageUrl: _imageUrl, ...rest } = section;
      return rest;
    });

  if (pendingIndexes.length === 0) return finalize(stripped);

  const supabase = getSupabase();
  if (!supabase) return null;

  const response = await fetch("/api/generated-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: blobs.map((blob) => ({ ext: extForMime(blob.type) })) })
  });
  if (!response.ok) return null;
  const data = await response.json();
  const uploads = data?.uploads;
  if (!Array.isArray(uploads) || uploads.length !== blobs.length) return null;

  for (let index = 0; index < blobs.length; index += 1) {
    const { path, token } = uploads[index] || {};
    if (!path || !token) return null;
    const { error } = await supabase.storage
      .from("generated")
      .uploadToSignedUrl(path, token, blobs[index], { contentType: blobs[index].type || "image/png" });
    if (error) return null;
    stripped[pendingIndexes[index]] = { ...stripped[pendingIndexes[index]], imagePath: path };
  }
  return finalize(stripped);
}

// 경로만 저장된 섹션에 서명 다운로드 URL(1시간)을 복원한다.
export async function resolveSectionImages(sections: CloudSection[]): Promise<CloudSection[]> {
  const paths = sections
    .map((section) => section.imagePath)
    .filter((path): path is string => typeof path === "string" && path.startsWith("gen/"));
  if (paths.length === 0) return sections;

  try {
    const response = await fetch("/api/generated-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sign", paths })
    });
    if (!response.ok) return sections;
    const data = await response.json();
    const urlMap = new Map<string, string>(
      (Array.isArray(data?.urls) ? data.urls : [])
        .filter((entry: { path?: string; url?: string }) => entry?.path && entry?.url)
        .map((entry: { path: string; url: string }) => [entry.path, entry.url])
    );
    return sections.map((section) => {
      const signed = section.imagePath ? urlMap.get(section.imagePath) : undefined;
      return signed ? { ...section, imageUrl: signed } : section;
    });
  } catch {
    return sections;
  }
}

async function deleteGeneratedImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await fetch("/api/generated-images", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths })
  });
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
  if (data?.sections && Array.isArray(data.sections)) {
    data.sections = await resolveSectionImages(data.sections as CloudSection[]);
  }
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
  const user = await getCurrentUser();
  if (!user) return;

  // 행 삭제 전에 이미지 경로를 확보해 버킷 파일까지 연쇄 정리한다.
  let paths: string[] = [];
  try {
    const { data } = await sb
      .from("projects")
      .select("sections")
      .eq("user_id", user.id)
      .eq("local_id", localId)
      .maybeSingle();
    paths = collectImagePaths(data?.sections);
  } catch {
    paths = [];
  }

  await sb.from("projects").delete().eq("user_id", user.id).eq("local_id", localId);
  if (paths.length > 0) deleteGeneratedImages(paths).catch(() => {});
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
