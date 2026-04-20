import { NextRequest, NextResponse } from "next/server";

async function carrier411Login(): Promise<string | null> {
  const username = process.env.CARRIER411_USERNAME;
  const password = process.env.CARRIER411_PASSWORD;
  
  console.log("[carrier411] username set:", !!username, "password set:", !!password);
  if (!username || !password) return null;

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <wsLogin xmlns="http://www.carrier411.com/">
      <Username>${username}</Username>
      <Password>${password}</Password>
    </wsLogin>
  </soap:Body>
</soap:Envelope>`;

  try {
    console.log("[carrier411] attempting login...");
    const res = await fetch("https://www.carrier411.com/webservices/wsLogin.cfc", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "wsLogin",
      },
      body: soapBody,
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    console.log("[carrier411] login response status:", res.status);
    console.log("[carrier411] login response (first 500):", text.slice(0, 500));
    
    // Try various patterns to extract session UUID
    const patterns = [
      /<SessionUUID[^>]*>([^<]+)<\/SessionUUID>/i,
      /<wsLoginReturn[^>]*>([^<]+)<\/wsLoginReturn>/i,
      /<return[^>]*>([^<]+)<\/return>/i,
      />([0-9a-f-]{36})</i,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1] && m[1].length > 10) {
        console.log("[carrier411] session UUID found:", m[1].slice(0, 8) + "...");
        return m[1];
      }
    }
    console.log("[carrier411] no session UUID found in response");
    return null;
  } catch (err) {
    console.error("[carrier411] login error:", err);
    return null;
  }
}

async function carrier411GetCompany(sessionUUID: string, docketNumber: string): Promise<Record<string, string> | null> {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <wsGetCompany xmlns="http://www.carrier411.com/">
      <SessionUUID>${sessionUUID}</SessionUUID>
      <DocketNumber>${docketNumber}</DocketNumber>
    </wsGetCompany>
  </soap:Body>
</soap:Envelope>`;

  try {
    console.log("[carrier411] calling wsGetCompany for docket:", docketNumber);
    const res = await fetch("https://www.carrier411.com/webservices/wsGetCompany.cfc", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "wsGetCompany",
      },
      body: soapBody,
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    console.log("[carrier411] getCompany response status:", res.status);
    console.log("[carrier411] getCompany response (first 800):", text.slice(0, 800));

    const extract = (tag: string) => {
      const m = text.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i"));
      return m?.[1]?.trim() || "";
    };

    const companyName = extract("LegalName") || extract("CompanyName") || extract("Name") || extract("DBAName");
    if (!companyName) {
      console.log("[carrier411] no company name found");
      return null;
    }

    return {
      name: companyName,
      dba: extract("DBAName"),
      address: extract("PhysicalAddress") || extract("MailingAddress") || extract("Address"),
      city: extract("PhysicalCity") || extract("MailingCity") || extract("City"),
      state: extract("PhysicalState") || extract("MailingState") || extract("State"),
      zip: extract("PhysicalZip") || extract("MailingZip") || extract("Zip"),
      phone: extract("Telephone") || extract("Phone"),
      email: extract("Email") || extract("EmailAddress"),
      dot: extract("DOTNumber") || extract("USDOTNumber"),
      mc: extract("MCNumber") || extract("DocketNumber") || docketNumber,
      type: extract("CarrierOperation") || extract("EntityType") || "Motor Carrier",
      status: extract("AuthorityStatus") || extract("OperatingStatus") || "Active",
      safetyRating: extract("SafetyRating"),
      insuranceOnFile: extract("InsuranceOnFile") || extract("BIPDOnFile"),
      cargoInsOnFile: extract("CargoOnFile"),
      totalDrivers: extract("TotalDrivers"),
      totalPowerUnits: extract("TotalPowerUnits"),
      source: "carrier411",
    };
  } catch (err) {
    console.error("[carrier411] getCompany error:", err);
    return null;
  }
}

async function fmcsaLookup(mode: string, cleanValue: string): Promise<Record<string, string> | null> {
  const fmcsaKey = process.env.FMCSA_API_KEY;
  console.log("[fmcsa] key set:", !!fmcsaKey);
  if (!fmcsaKey) return null;

  try {
    const endpoint = mode === "MC"
      ? `https://mobile.fmcsa.dot.gov/qc/services/carriers/docket-number/${cleanValue}?webKey=${fmcsaKey}`
      : `https://mobile.fmcsa.dot.gov/qc/services/carriers/${cleanValue}?webKey=${fmcsaKey}`;

    console.log("[fmcsa] calling endpoint for", mode, cleanValue);
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
    console.log("[fmcsa] response status:", res.status);
    if (!res.ok) return null;

    const json = await res.json();
    const c = json?.content?.carrier;
    console.log("[fmcsa] carrier found:", !!c, c?.legalName);
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
      mc: c.mcNumber ? `MC${c.mcNumber}` : (mode === "MC" ? `MC${cleanValue}` : ""),
      type: "Motor Carrier",
      status: c.allowedToOperate === "Y" ? "Active" : "Inactive",
      source: "fmcsa",
    };
  } catch (err) {
    console.error("[fmcsa] error:", err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "MC";
  const value = searchParams.get("value") || "";
  const cleanValue = value.replace(/[^0-9]/g, "");

  console.log("[lookup] mode:", mode, "value:", cleanValue);

  if (cleanValue.length < 3) {
    return NextResponse.json({ carrier: null, error: "Number too short" });
  }

  // Format docket: MC + 6 digits padded with leading zeros
  const docket = `MC${cleanValue.padStart(6, "0")}`;
  console.log("[lookup] formatted docket:", docket);

  let carrier: Record<string, string> | null = null;

  // Try Carrier411 first (MC lookups only)
  if (mode === "MC") {
    const sessionUUID = await carrier411Login();
    if (sessionUUID) {
      carrier = await carrier411GetCompany(sessionUUID, docket);
    }
  }

  // Fallback to FMCSA
  if (!carrier) {
    console.log("[lookup] falling back to FMCSA");
    carrier = await fmcsaLookup(mode, cleanValue);
  }

  console.log("[lookup] final result:", carrier ? `found: ${carrier.name}` : "not found");
  return NextResponse.json({ carrier: carrier || null });
}
