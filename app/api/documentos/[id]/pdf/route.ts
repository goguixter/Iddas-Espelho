import { NextResponse } from "next/server";
import { renderDocumentPdf } from "@/lib/documents/pdf";
import { getDocumentRecord } from "@/lib/documents/repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const documentId = Number(id);

  if (!Number.isFinite(documentId)) {
    return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  }

  const document = getDocumentRecord(documentId);

  if (!document) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  try {
    const pdf = await renderDocumentPdf(document.html_snapshot);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-disposition": `inline; filename="${document.title}.pdf"`,
        "content-type": "application/pdf",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar o PDF do documento.",
      },
      { status: 500 },
    );
  }
}
