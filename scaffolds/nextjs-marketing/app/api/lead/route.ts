import { NextResponse } from "next/server";

/**
 * Lead capture stub. Replace this with a call to your CRM or the
 * @pagemate/* lead-capture tool once one ships. Until then the
 * endpoint just echoes the submission back as JSON so the form has
 * somewhere to POST to during development.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const body = Object.fromEntries(formData.entries());
  console.log("[lead]", body);
  return NextResponse.json({ ok: true, echo: body });
}
