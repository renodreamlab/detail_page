import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const UPLOAD_BUCKET = "uploads";
const MAX_FILES = 8;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const STORAGE_PATH_PATTERN = /^ref\/[0-9a-f-]{36}\/\d{1,2}\.(jpg|jpeg|png|webp)$/i;

function storageAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: NextRequest) {
  const supabase = storageAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "업로드 저장소가 설정되지 않았습니다." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const files = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];
  if (files.length === 0) {
    return NextResponse.json({ error: "업로드할 파일 정보가 필요합니다." }, { status: 400 });
  }

  const batchId = randomUUID();
  const uploads: Array<{ path: string; token: string }> = [];

  for (const [index, file] of files.entries()) {
    const size = Number(file?.size || 0);
    const type = String(file?.type || "");
    if (!type.startsWith("image/")) {
      return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (!size || size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "파일당 최대 15MB까지 업로드할 수 있습니다." }, { status: 400 });
    }

    const extension = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const path = `ref/${batchId}/${index + 1}.${extension}`;
    const { data, error } = await supabase.storage.from(UPLOAD_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error(`[upload-url] signed url failed: ${error?.message}`);
      return NextResponse.json({ error: "업로드 URL 발급에 실패했습니다." }, { status: 500 });
    }
    uploads.push({ path: data.path, token: data.token });
  }

  return NextResponse.json({ uploads });
}

export async function DELETE(request: NextRequest) {
  const supabase = storageAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "업로드 저장소가 설정되지 않았습니다." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const paths = Array.isArray(body?.paths)
    ? body.paths.filter((path: unknown): path is string => typeof path === "string" && STORAGE_PATH_PATTERN.test(path)).slice(0, MAX_FILES)
    : [];
  if (paths.length === 0) {
    return NextResponse.json({ error: "삭제할 경로가 필요합니다." }, { status: 400 });
  }

  const { error } = await supabase.storage.from(UPLOAD_BUCKET).remove(paths);
  if (error) {
    console.error(`[upload-url] delete failed: ${error.message}`);
    return NextResponse.json({ error: "저장소 정리에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ removed: paths.length });
}
