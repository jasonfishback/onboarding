import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") || "MC").toUpperCase();
  const raw = searchParams.get("value") || "";
  const value = raw.replace(/[^0-9]/g, "");

  if (value.length < 3) {
    return NextResponse.json({ carrier: null, error: "Too short" });
  }

  const key = process.env.FMCSA_API_KEY;
  if (!key) {
    return NextResponse.json({ carrier: null, error: "API key not configured" });
  }

  const url =
    mode === "MC"
      ? `https://mobile.fmcsa.dot.gov/qc/services/carriers/docket-number/${value}?webKey=${key}`
      : `https://mobile.fmcsa.dot.gov/qc/services/carriers/${value}?webKey=${key}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return NextResponse.json({ carrier: null });

    const json = await res.json();
    const c =
      json?.content?.carrier ??
      (Array.isArray(json?.content) ? json.content[0]?.carrier : null);

    if (!c) return NextResponse.json({ carrier: null });

    return NextResponse.json({
      carrier: {
        name: c.legalName || c.dbaName || "",
        dba: c.dbaName || "",
        address: c.phyStreet || "",
        city: c.phyCity || "",
        state: c.phyState || "",
        zip: c.phyZipcode || "",
        phone: c.telephone || "",
        email: c.emailAddress || "",
        dot: String(c.dotNumber || ""),
        mc:
          c.prefix && c.docketNumber
            ? `${c.prefix}${c.docketNumber}`
            : mode === "MC"
            ? `MC${value}`
            : "",
        type: "Motor Carrier",
        status: c.allowedToOperate === "Y" ? "Active" : "Inactive",
        source: "fmcsa",
      },
    });
  } catch (err) {
    console.error("[fmcsa] error:", String(err));
    return NextResponse.json({ carrier: null });
  }
}
