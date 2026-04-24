import { NextResponse } from "next/server";
import { getDatabaseImportStatus, stageDatabaseImport } from "@/lib/db-import";

export async function GET() {
  return NextResponse.json(getDatabaseImportStatus());
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo .sqlite." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const status = stageDatabaseImport(buffer);
    return NextResponse.json({
      message: "Base enviada com sucesso. Reinicie o serviço no Railway para aplicar a importação.",
      ...status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Não foi possível validar a base enviada.",
      },
      { status: 400 },
    );
  }
}
