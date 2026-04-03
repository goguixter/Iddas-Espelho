import { NextRequest } from "next/server";
import { getDocumentRecord } from "@/lib/documents/repository";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const document = getDocumentRecord(Number(id));

  if (!document) {
    return new Response("Documento não encontrado.", { status: 404 });
  }

  const shouldPrint = request.nextUrl.searchParams.get("print") === "1";
  const html = shouldPrint
    ? injectPrintScript(document.html_snapshot)
    : document.html_snapshot;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function injectPrintScript(html: string) {
  const script = `
<script>
  window.addEventListener("load", () => {
    setTimeout(() => {
      window.print();
    }, 150);
  });
</script>`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${script}</body>`);
  }

  return `${html}${script}`;
}
