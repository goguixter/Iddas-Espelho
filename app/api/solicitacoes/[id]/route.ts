import { NextResponse } from "next/server";
import { getSolicitacaoDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = await getSolicitacaoDetail(id);

  if (!detail) {
    return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
