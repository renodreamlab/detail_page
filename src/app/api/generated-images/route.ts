import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const GENERATED_BUCKET = "generated";
const MAX_FILES = 16;
const MAX_SIGN_PATHS = 64;
const SIGNED_URL_TTL_SECONDS = 3600;
const GENERATED_PATH_PATTERN = /^gen\/[0-9a-f-]{36}\/\d{1,3}\.(png|jpg|jpeg|webp)$/i;

function storageAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function validPaths(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((path): path is string => typeof path === "string" && GENERATED_PATH_PATTERN.test(path))
    .slice(0, limit);
}

function normalizeExt(value: unknown): string {
  const ext = String(value || "").toLowerCase();
  if (ext === "png" || ext === "webp" || ext === "jpeg") return ext;
  return "jpg";
}

// 생성 결과 이미지 Storage 라우트.
// POST { files:[{ext}] }            -> 서명 업로드 URL 발급 (경로: gen/<uuid>/<n>.<ext>)
// POST { action:"sign", paths }     -> 서명 다운로드 URL 발급 (1시간)
// DELETE { paths }                  -> 파일 삭제 (재저장 고아 파일·프로젝트 삭제 정리)
export async function POST(request: NextRequest) {
  const supabase = storageAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "결과 저장소가 설정되지 않았습니다." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);

  if (body?.action === "sign") {
    const paths = validPaths(body?.paths, MAX_SIGN_PATHS);
    if (paths.length === 0) {
      return NextResponse.json({ error: "서명할 경로가 필요합니다." }, { status: 400 });
    }
    const urls: Array<{ path: string; url: string }> = [];
    for (const path of paths) {
      const { data, error } = await supabase.storage.from(GENERATED_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (error || !data) {
        // 일부 파일이 없어도 나머지는 복원되도록 건너뛴다.
        console.warn(`[generated-images] sign failed for ${path}: ${error?.message}`);
        continue;
      }
      urls.push({ path, url: data.signedUrl });
    }
    return NextResponse.json({ urls });
  }

  const files = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];
  if (files.length === 0) {
    return NextResponse.json({ error: "업로드할 파일 정보가 필요합니다." }, { status: 400 });
  }

  const batchId = randomUUID();
  const uploads: Array<{ path: string; token: string }> = [];
  for (const [index, file] of files.entries()) {
    const path = `gen/${batchId}/${index + 1}.${normalizeExt(file?.ext)}`;
    const { data, error } = await supabase.storage.from(GENERATED_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error(`[generated-images] signed upload url failed: ${error?.message}`);
      return NextResponse.json({ error: "업로드 URL 발급에 실패했습니다." }, { status: 500 });
    }
    uploads.push({ path: data.path, token: data.token });
  }
  return NextResponse.json({ uploads });
}

export async function DELETE(request: NextRequest) {
  const supabase = storageAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "결과 저장소가 설정되지 않았습니다." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const paths = validPaths(body?.paths, MAX_SIGN_PATHS);
  if (paths.length === 0) {
    return NextResponse.json({ error: "삭제할 경로가 필요합니다." }, { status: 400 });
  }

  const { error } = await supabase.storage.from(GENERATED_BUCKET).remove(paths);
  if (error) {
    console.error(`[generated-images] delete failed: ${error.message}`);
    return NextResponse.json({ error: "저장소 정리에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ removed: paths.length });
}
