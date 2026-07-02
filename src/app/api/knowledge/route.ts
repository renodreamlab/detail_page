import { NextRequest, NextResponse } from "next/server";
import { canManageCommonKnowledge } from "@/lib/knowledge-access";
import { deleteKnowledgeDocument, getKnowledgeStats, indexKnowledgeDocument, isRagConfigured } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    if (!isRagConfigured()) {
      return NextResponse.json({
        configured: false,
        documents: 0,
        chunks: 0,
        reason: "DATABASE_URL과 OPENAI_API_KEY를 설정하면 맞춤형 Data 설정 저장소가 활성화됩니다."
      });
    }

    return NextResponse.json(await getKnowledgeStats());
  } catch (error) {
    return NextResponse.json(
      { configured: true, error: error instanceof Error ? error.message : "맞춤형 Data 설정 상태 확인 실패" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || "knowledge-file");
    const text = String(body.text || "");
    const adminKey = String(body.adminKey || "");

    if (!canManageCommonKnowledge(adminKey)) {
      return NextResponse.json({ error: "맞춤형 Data 설정 등록 권한 키가 올바르지 않습니다." }, { status: 403 });
    }

    if (!text.trim()) {
      return NextResponse.json({ error: "인덱싱할 텍스트가 없습니다." }, { status: 400 });
    }

    if (!isRagConfigured()) {
      return NextResponse.json({
        configured: false,
        indexed: false,
        chunks: 0,
        reason: "DATABASE_URL과 OPENAI_API_KEY가 없어 로컬 맞춤형 Data 설정으로 등록했습니다."
      });
    }

    const result = await indexKnowledgeDocument({ name, text });
    return NextResponse.json({ configured: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "맞춤형 Data 설정 적용 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const documentId = String(body.documentId || "");
    const adminKey = String(body.adminKey || "");

    if (!canManageCommonKnowledge(adminKey)) {
      return NextResponse.json({ error: "맞춤형 Data 설정 삭제 권한 키가 올바르지 않습니다." }, { status: 403 });
    }

    if (!documentId) {
      return NextResponse.json({ deleted: false, reason: "documentId가 없습니다." });
    }

    if (!isRagConfigured()) {
      return NextResponse.json({ deleted: false, reason: "맞춤형 Data 설정 저장소가 설정되지 않아 로컬 목록에서만 삭제합니다." });
    }

    return NextResponse.json(await deleteKnowledgeDocument(documentId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "맞춤형 Data 설정 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

