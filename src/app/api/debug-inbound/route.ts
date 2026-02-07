import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/debug-inbound
 * Diagnostic endpoint — accepts any POST and dumps everything about the request.
 * No auth, no parsing, no Supabase. Pure debugging.
 */
export async function POST(request: NextRequest) {
  const info: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
  };

  // 1. Capture all headers
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  info.headers = headers;
  info.contentType = request.headers.get("content-type");

  // 2. Try reading body as text (clone first so we can try formData after)
  let rawBody = "";
  try {
    const cloned = request.clone();
    rawBody = await cloned.text();
    info.bodyAsText = rawBody.substring(0, 2000);
    info.bodyLength = rawBody.length;
  } catch (e) {
    info.bodyAsTextError = e instanceof Error ? e.message : String(e);
  }

  // 3. Try reading body as formData
  try {
    const formData = await request.formData();
    const fields: Record<string, string> = {};
    let fieldCount = 0;
    formData.forEach((value, key) => {
      fieldCount++;
      if (typeof value === "string") {
        fields[key] = value.length > 200 ? value.substring(0, 200) + "..." : value;
      } else {
        // File/Blob
        fields[key] = `[File: name=${value.name}, size=${value.size}, type=${value.type}]`;
      }
    });
    info.formData = fields;
    info.formDataFieldCount = fieldCount;

    // 4. Specifically check for the fields /api/inbound expects
    info.signatureFields = {
      timestamp: formData.get("timestamp"),
      token: formData.get("token") ? String(formData.get("token")).substring(0, 20) + "..." : null,
      signature: formData.get("signature") ? String(formData.get("signature")).substring(0, 20) + "..." : null,
    };
    info.emailFields = {
      sender: formData.get("sender"),
      from: formData.get("from"),
      subject: formData.get("subject"),
      "body-plain": formData.get("body-plain") ? "present (" + String(formData.get("body-plain")).length + " chars)" : null,
      "stripped-text": formData.get("stripped-text") ? "present (" + String(formData.get("stripped-text")).length + " chars)" : null,
    };
  } catch (e) {
    info.formDataError = e instanceof Error ? e.message : String(e);
    info.formDataErrorStack = e instanceof Error ? e.stack : undefined;

    // 5. If formData fails, try parsing as URL-encoded
    try {
      const params = new URLSearchParams(rawBody);
      const parsed: Record<string, string> = {};
      params.forEach((value, key) => {
        parsed[key] = value.length > 200 ? value.substring(0, 200) + "..." : value;
      });
      info.urlEncodedFallback = parsed;
      info.urlEncodedFieldCount = Object.keys(parsed).length;
    } catch (e2) {
      info.urlEncodedError = e2 instanceof Error ? e2.message : String(e2);
    }
  }

  console.log("DEBUG-INBOUND:", JSON.stringify(info, null, 2));

  return NextResponse.json(info);
}

/**
 * GET /api/debug-inbound
 * Quick health check — verifies the endpoint is deployed and reachable.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Debug inbound endpoint is live. POST to this URL to inspect webhook payloads.",
    timestamp: new Date().toISOString(),
  });
}
