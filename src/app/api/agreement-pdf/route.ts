import { NextRequest, NextResponse } from "next/server";
import { generateAgreementPDF } from "@/lib/generateAgreementPdf";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bytes = await generateAgreementPDF(body);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Simon_Express_Carrier_Agreement.pdf"`,
      },
    });
  } catch (err) {
    console.error("[agreement-pdf]", String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
