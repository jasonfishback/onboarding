import { NextRequest, NextResponse } from "next/server";

// ─── Carrier411 SOAP helper ────────────────────────────────────────────
async function carrier411Login(): Promise<string | null> {
  const username = process.env.CARRIER411_USERNAME;
  const password = process.env.CARRIER411_PASSWORD;
  if (!username || !password) return null;

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <wsLogin xmlns="http://www.carrier411.com/wsLogin">
      <Username>${username}</Username>
      <Password>${password}</Password>
    </wsLogin>
  </soap:Body>
</soap:Envelope>`;

  try {
    const res = await fetch("https://www.carrier411.com/wsLogin.cfc?wsdl", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://www.carrier411.com/wsLogin",
      },
      body: soapBody,
    });
    const text = await res.text();
    // Extract SessionUUID from response
    const match = text.match(/<SessionUUID[^>]*>([^<]+)<\/SessionUUID>/i)
      || text.match(/<wsLoginReturn[^>]*>([^<]+)<\/wsLoginReturn>/i)
      || text.match(/<return[^>]*>([^<]+)<\/return>/i);
    return match?.[1] || null;
  } catch (err) {
    console.error("Carrier411 login error:", err);
    return null;
  }
}

async function carrier411GetCompany(sessionUUID: string, docketNumber: string): Promise<Record<string, string> | null> {
  // Docket must be 8 chars: MC + 6 digits (with leading zeros)
  const cleanDocket = docketNumber.replace(/\s+/g, "").toUpperCase();

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <wsGetCompany xmlns="http://www.carrier411.com/wsGetCompany">
      <SessionUUID>${sessionUUID}</SessionUUID>
      <DocketNumber>${cleanDocket}</DocketNumber>
    </wsGetCompany>
  </soap:Body>
</soap:Envelope>`;

  try {
    const res = await fetch("https://www.carrier411.com/wsGetCompany.cfc?wsdl", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://www.carrier411.com/wsGetCompany",
      },
      body: soapBody,
    });
    const text = await res.text();

    // Parse all fields from the SOAP response
    const extract = (tag: string) => {
      const m = text.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"));
      return m?.[1]?.trim() || "";
    };

    const companyName = extract("LegalName") || extract("CompanyName") || extract("DBAName");
    if (!companyName) return null;

    return {
      name: companyName,
      dba: extract("DBAName"),
      address: extract("PhysicalAddress") || extract("Address"),
      city: extract("PhysicalCity") || extract("City"),
      state: extract("PhysicalState") || extract("State"),
      zip: extract("PhysicalZip") || extract("Zip"),
      phone: extract("Telephone") || extract("Phone"),
      email: extract("Email") || extract("EmailAddress"),
      dot: extract("DOTNumber") || extract("USDOTNumber"),
      mc: extract("MCNumber") || extract("DocketNumber") || cleanDocket,
      type: extract("CarrierOperation") || extract("EntityType") || "Motor Carrier",
      status: extract("AuthorityStatus") || extract("OperatingStatus") || "Active",
      // Extra Carrier411 fields
      safetyRating: extract("SafetyRating"),
      insuranceOnFile: extract("InsuranceOnFile") || extract("BIPDOnFile"),
      cargoInsOnFile: extract("CargoOnFile"),
      totalDrivers: extract("TotalDrivers"),
      totalPowerUnits: extract("TotalPowerUnits"),
      source: "carrier411",
    };
  } catch (err) {
    console.error("Carrier411 getCompany error:", err);
    return null;
  }
}

// Optionally start monitoring the carrier in Carrier411
async function carrier411StartMonitoring(sessionUUID: string, docketNumber: string) {
  const cleanDocket = docketNumber.replace(/\s+/g, "").toUpperCase();

  // First check if already monitored
  const statusBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <wsGet411Status xmlns="http://www.carrier411.com/wsGet411Status">
      <SessionUUID>${sessionUUID}</SessionUUID>
      <DocketNumber>${cleanDocket}</DocketNumber>
    </wsGet411Status>
  </soap:Body>
</soap:Envelope>`;

  try {
    const statusRes = await fetch("https://www.carrier411.com/wsGet411Status.cfc?wsdl", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://www.carrier411.com/wsGet411Status",
      },
      body: statusBody,
    });
    const statusText = await statusRes.text();
    // If already monitored, skip
    if (statusText.toLowerCase().includes("true") || statusText.includes("1")) return;

    // Start monitoring
    const monitorBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <wsStartMonitoring xmlns="http://www.carrier411.com/wsStartMonitoring">
      <SessionUUID>${sessionUUID}</SessionUUID>
      <DocketNumber>${cleanDocket}</DocketNumber>
    </wsStartMonitoring>
  </soap:Body>
</soap:Envelope>`;

    await fetch("https://www.carrier411.com/wsStartMonitoring.cfc?wsdl", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://www.carrier411.com/wsStartMonitoring",
      },
      body: monitorBody,
    });
  } catch (err) {
    console.error("Carrier411 monitoring error:", err);
  }
}

// ─── FMCSA API fallback ────────────────────────────────────────────────
async function fmcsaLookup(mode: string, cleanValue: string): Promise<Record<string, string> | null> {
  const fmcsaKey = process.env.FMCSA_API_KEY;
  if (!fmcsaKey) return null;

  try {
    const endpoint =
      mode === "MC"
        ? `https://mobile.fmcsa.dot.gov/qc/services/carriers/docket-number/${cleanValue}?webKey=${fmcsaKey}`
        : `https://mobile.fmcsa.dot.gov/qc/services/carriers/${cleanValue}?webKey=${fmcsaKey}`;

    const res = await fetch(endpoint, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const json = await res.json();
    const c = json?.content?.carrier;
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
      type: c.carrierOperation?.carrier ? "Motor Carrier" : "Broker",
      status: c.allowedToOperate === "Y" ? "Active" : "Inactive",
      source: "fmcsa",
    };
  } catch (err) {
    console.error("FMCSA lookup error:", err);
    return null;
  }
}

// ─── Main handler ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "MC"; // MC or DOT
  const value = searchParams.get("value") || "";
  const cleanValue = value.replace(/[^0-9]/g, "");

  if (cleanValue.length < 3) {
    return NextResponse.json({ carrier: null, error: "Number too short" });
  }

  // Format docket for Carrier411: must be 8 chars e.g. MC455455
  const docket = mode === "MC"
    ? `MC${cleanValue.padStart(6, "0")}`
    : `MC${cleanValue}`; // Carrier411 needs MC docket, not DOT

  // ── Try Carrier411 first (primary) ──
  let carrier: Record<string, string> | null = null;

  const sessionUUID = await carrier411Login();
  if (sessionUUID) {
    if (mode === "MC") {
      carrier = await carrier411GetCompany(sessionUUID, docket);
    }
    // If MC lookup worked, also start monitoring
    if (carrier) {
      // Fire-and-forget monitoring
      carrier411StartMonitoring(sessionUUID, docket).catch(() => {});
    }

    // For DOT lookups or if MC failed, try FMCSA
    if (!carrier && mode === "DOT") {
      carrier = await fmcsaLookup("DOT", cleanValue);
      // If FMCSA returned a result with an MC, also try adding to Carrier411 monitoring
      if (carrier?.mc && sessionUUID) {
        carrier411StartMonitoring(sessionUUID, carrier.mc).catch(() => {});
      }
    }
  }

  // ── Fallback to FMCSA API ──
  if (!carrier) {
    carrier = await fmcsaLookup(mode, cleanValue);
  }

  if (carrier) {
    return NextResponse.json({ carrier });
  }

  return NextResponse.json({ carrier: null });
}
