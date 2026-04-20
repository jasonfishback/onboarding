import { NextRequest, NextResponse } from "next/server";

// ─── Carrier411 SOAP ───────────────────────────────────────────────────────
async function carrier411Login(): Promise<string | null> {
  const username = process.env.CARRIER411_USERNAME;
  const password = process.env.CARRIER411_PASSWORD;
  if (!username || !password) {
    console.log("[c411] credentials missing");
    return null;
  }

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://www.carrier411.com/">
  <soapenv:Header/>
  <soapenv:Body>
    <web:wsLogin>
      <web:Username>${username}</web:Username>
      <web:Password>${password}</web:Password>
    </web:wsLogin>
  </soapenv:Body>
</soapenv:Envelope>`;

  try {
    const res = await fetch("https://www.carrier411.com/webservices/wsLogin.cfc", {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "" },
      body: soapBody,
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text();
    console.log("[c411] login status:", res.status, "| body snippet:", text.slice(0, 300));

    // Extract UUID - try multiple patterns
    for (const pattern of [
      /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/,
      /<return[^>]*>([^<]+)<\/return>/i,
      /<wsLoginReturn[^>]*>([^<]+)<\/wsLoginReturn>/i,
    ]) {
      const m = text.match(pattern);
      if (m?.[1] && m[1].length > 10) {
        console.log("[c411] session obtained");
        return m[1];
      }
    }
    console.log("[c411] no session UUID in response");
    return null;
  } catch (err) {
    console.error("[c411] login error:", String(err));
    return null;
  }
}

async function carrier411GetCompany(session: string, docket: string): Promise<Record<string, string> | null> {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://www.carrier411.com/">
  <soapenv:Header/>
  <soapenv:Body>
    <web:wsGetCompany>
      <web:SessionUUID>${session}</web:SessionUUID>
      <web:DocketNumber>${docket}</web:DocketNumber>
    </web:wsGetCompany>
  </soapenv:Body>
</soapenv:Envelope>`;

  try {
    const res = await fetch("https://www.carrier411.com/webservices/wsGetCompany.cfc", {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "" },
      body: soapBody,
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text();
    console.log("[c411] getCompany status:", res.status, "| snippet:", text.slice(0, 500));

    const get = (tag: string) =>
      text.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i"))?.[1]?.trim() ?? "";

    // Try all known field name variants
    const name = get("LegalName") || get("legalName") || get("CompanyName") || get("companyName") || get("Name");
    if (!name) { console.log("[c411] no company name found"); return null; }

    return {
      name,
      dba: get("DBAName") || get("dbaName"),
      address: get("PhysicalAddress") || get("physicalAddress") || get("Address"),
      city: get("PhysicalCity") || get("physicalCity") || get("City"),
      state: get("PhysicalState") || get("physicalState") || get("State"),
      zip: get("PhysicalZip") || get("physicalZip") || get("Zip"),
      phone: get("Telephone") || get("telephone") || get("Phone"),
      email: get("Email") || get("EmailAddress"),
      dot: get("DOTNumber") || get("dotNumber") || get("USDOTNumber"),
      mc: get("MCNumber") || get("mcNumber") || docket,
      type: get("CarrierOperation") || get("EntityType") || "Motor Carrier",
      status: get("AuthorityStatus") || get("OperatingStatus") || "Active",
      safetyRating: get("SafetyRating") || get("safetyRating"),
      insuranceOnFile: get("InsuranceOnFile") || get("BIPDOnFile"),
      totalDrivers: get("TotalDrivers") || get("totalDrivers"),
      totalPowerUnits: get("TotalPowerUnits") || get("totalPowerUnits"),
      source: "carrier411",
    };
  } catch (err) {
    console.error("[c411] getCompany error:", String(err));
    return null;
  }
}

// ─── FMCSA REST API ────────────────────────────────────────────────────────
async function fmcsaLookup(mode: string, value: string): Promise<Record<string, string> | null> {
  const key = process.env.FMCSA_API_KEY;
  if (!key) { console.log("[fmcsa] no API key"); return null; }

  // FMCSA endpoint: MC lookup uses docket-number, DOT lookup uses dot number directly
  const url = mode === "MC"
    ? `https://mobile.fmcsa.dot.gov/qc/services/carriers/docket-number/${value}?webKey=${key}`
    : `https://mobile.fmcsa.dot.gov/qc/services/carriers/${value}?webKey=${key}`;

  try {
    console.log("[fmcsa] fetching:", url.replace(key, "***"));
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const text = await res.text();
    console.log("[fmcsa] status:", res.status, "| snippet:", text.slice(0, 300));
    if (!res.ok) return null;

    const json = JSON.parse(text);
    // FMCSA returns either content.carrier (single) or content (array)
    const c = json?.content?.carrier ?? (Array.isArray(json?.content) ? json.content[0]?.carrier : null);
    console.log("[fmcsa] carrier found:", !!c, c?.legalName ?? "—");
    if (!c) return null;

    return {
      name: c.legalName || c.dbaName || "",
      dba: c.dbaName || "",
      address: c.phyStreet || "",
      city: c.phyCity || "",
      state: c.phyState || "",
      zip: c.phyZipcode || "",
      phone: c.telephone || "",
      email: c.emailAddress || "",
      dot: String(c.dotNumber || ""),
      mc: c.prefix && c.docketNumber ? `${c.prefix}${c.docketNumber}` : (mode === "MC" ? `MC${value}` : ""),
      type: "Motor Carrier",
      status: c.allowedToOperate === "Y" ? "Active" : "Inactive",
      source: "fmcsa",
    };
  } catch (err) {
    console.error("[fmcsa] error:", String(err));
    return null;
  }
}

// ─── Route handler ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") || "MC").toUpperCase();
  const raw = searchParams.get("value") || "";
  const value = raw.replace(/[^0-9]/g, "");

  if (value.length < 3) return NextResponse.json({ carrier: null, error: "Too short" });

  // Carrier411 needs: MC + 6 digits zero-padded e.g. MC012345
  const docket = `MC${value.padStart(6, "0")}`;
  console.log("[lookup] mode:", mode, "clean value:", value, "docket:", docket);

  let carrier: Record<string, string> | null = null;

  // ── Try Carrier411 first (MC only) ──
  if (mode === "MC") {
    const session = await carrier411Login();
    if (session) {
      carrier = await carrier411GetCompany(session, docket);
    }
  }

  // ── Fallback to FMCSA ──
  if (!carrier) {
    console.log("[lookup] trying FMCSA fallback");
    carrier = await fmcsaLookup(mode, value);
  }

  console.log("[lookup] result:", carrier ? `✓ ${carrier.name} (${carrier.source})` : "not found");
  return NextResponse.json({ carrier: carrier ?? null });
}
