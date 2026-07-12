import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getRequestToken, q } from "@/lib/db";

// يصدر تصريح رفع مباشر إلى التخزين السحابي بعد التحقق من رمز إقفال العهدة
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const token = String(clientPayload ?? "");
        // يُقبل الرفع برمز إقفال عهدة مفتوحة، أو بالرمز العام (الإقفال المباشر)
        if (token !== (await getRequestToken())) {
          const rows = await q(
            "SELECT id FROM custodies WHERE close_token = $1 AND status = 'open'",
            [token]
          );
          if (rows.length === 0) throw new Error("رابط الإقفال غير صالح");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشل الرفع" },
      { status: 400 }
    );
  }
}
