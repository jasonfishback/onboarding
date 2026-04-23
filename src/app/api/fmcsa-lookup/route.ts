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

    // Build MC# from prefix+docketNumber, or fall back to value for MC lookups
    let mc = c.prefix && c.docketNumber
      ? `${c.prefix}${c.docketNumber}`
      : mode === "MC" ? `MC${value}` : "";

    // For DOT lookups where MC# wasn't returned directly,
    // try the carrier's operating authority endpoint
    if (mode === "DOT" && !mc && c.dotNumber) {
      try {
        const authRes = await fetch(
          `https://mobile.fmcsa.dot.gov/qc/services/carriers/${c.dotNumber}/authority?webKey=${key}`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (authRes.ok) {
          const authJson = await authRes.json();
          const auths = authJson?.content;
          if (Array.isArray(auths) && auths.length > 0) {
            // Find first MC authority
            const mcAuth = auths.find((a: Record<string, string>) => a.prefix === "MC") || auths[0];
            if (mcAuth?.prefix && mcAuth?.docketNumber) {
              mc = `${mcAuth.prefix}${mcAuth.docketNumber}`;
            }
          }
        }
      } catch {
        // Non-critical — DOT-only carriers may not have an MC
      }
    }

    // Fetch officer/registrant name (useful to pre-fill Primary Contact)
    let officerName = "";
    if (c.dotNumber) {
      try {
        const officerRes = await fetch(
          `https://mobile.fmcsa.dot.gov/qc/services/carriers/${c.dotNumber}/officers?webKey=${key}`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (officerRes.ok) {
          const officerJson = await officerRes.json();
          console.log("[fmcsa] officer response:", JSON.stringify(officerJson).slice(0, 500));
          // Response can be a single object or array; handle both
          const officerContent = officerJson?.content;
          const officer = Array.isArray(officerContent) ? officerContent[0] : officerContent;
          if (officer) {
            // Common fields: fullName, firstName, middleName, lastName, name
            officerName = officer.fullName || officer.name ||
              [officer.firstName, officer.middleName, officer.lastName].filter(Boolean).join(" ").trim() ||
              "";
          }
        }
      } catch {
        // Non-critical — some carriers don't have officer records exposed
      }
    }

    // ── Scrape SAFER HTML for fields not in the QCMobile API ─────────────────
    //   - Physical + Mailing addresses
    //   - Phone
    //   These come back in a public HTML snapshot at safer.fmcsa.dot.gov
    let saferPhone = "";
    let mailingStreet = "", mailingCity = "", mailingState = "", mailingZip = "";
    if (c.dotNumber) {
      try {
        const saferRes = await fetch(
          `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${c.dotNumber}`,
          {
            signal: AbortSignal.timeout(8000),
            headers: { "User-Agent": "Mozilla/5.0 SimonExpressOnboarding/1.0" },
          }
        );
        if (saferRes.ok) {
          const html = await saferRes.text();
          console.log("[safer] html length:", html.length, "first 300:", html.slice(0, 300));
          console.log("[safer] has Phone:", html.includes("Phone:"), "has Mailing:", html.includes("Mailing Address:"));
          const cleanHtml = html.replace(/<br\s*\/?>/gi, "\n").replace(/&nbsp;/g, " ");
          const phoneMatch = cleanHtml.match(/Phone:\s*<\/TH>\s*<TD[^>]*>\s*([^<]+)/i);
          if (phoneMatch) {
            saferPhone = phoneMatch[1].replace(/[^0-9]/g, "").slice(0, 10);
          }
          // Mailing Address TD may have multi-line content (street + city/state/zip)
          const mailMatch = cleanHtml.match(/Mailing Address:\s*<\/TH>\s*<TD[^>]*>\s*([^<]+(?:\n[^<]+)*)/i);
          console.log("[safer] mailMatch:", mailMatch ? mailMatch[1].slice(0, 100) : "NONE");
          if (mailMatch) {
            const addrLines = mailMatch[1].split("\n").map(l => l.trim()).filter(Boolean);
            if (addrLines.length >= 2) {
              mailingStreet = addrLines[0];
              // Last line is typically "CITY, ST ZIP"
              const lastLine = addrLines[addrLines.length - 1];
              const cszMatch = lastLine.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
              if (cszMatch) {
                mailingCity = cszMatch[1].trim();
                mailingState = cszMatch[2];
                mailingZip = cszMatch[3].replace(/-.*$/, "");
              }
            } else if (addrLines.length === 1) {
              mailingStreet = addrLines[0];
            }
          }
        }
      } catch (e) {
        console.log("[safer] fetch failed:", String(e));
        // Non-critical — SAFER scrape timeout is fine, we'll just skip these fields
      }
    }

    return NextResponse.json({
      carrier: {
        name: c.legalName || c.dbaName || "",
        dba: c.dbaName || "",
        address: c.phyStreet || "",
        city: c.phyCity || "",
        state: c.phyState || "",
        zip: c.phyZipcode || "",
        phone: saferPhone || c.telephone || "",
        email: c.emailAddress || "",
        dot: String(c.dotNumber || ""),
        mc,
        type: "Motor Carrier",
        status: c.allowedToOperate === "Y" ? "Active" : "Inactive",
        officerName,
        // ── Mailing Address (from SAFER scrape) ──
        mailingAddress: mailingStreet,
        mailingCity,
        mailingState,
        mailingZip,
        // ── Additional fields from FMCSA census ──
        truckCount: c.totalPowerUnits != null ? String(c.totalPowerUnits) : "",
        driverCount: c.totalDrivers != null ? String(c.totalDrivers) : "",
        mcs150Date: c.mcs150Outdated === "N" ? "Current" : c.mcs150FormDate || "",
        operationClass: c.carrierOperation?.carrierOperationDesc || "",
        hazmatFlag: c.oic === "Y" ? "Yes" : "No",
        // FMCSA-reported EIN (used for verification, NOT for prefill)
        fmcsaEin: c.ein ? String(c.ein) : "",
        safetyRating: c.safetyRating || "",
        safetyRatingDate: c.safetyRatingDate || "",
        reviewDate: c.reviewDate || "",
        outOfService: c.statusCode === "INACTIVE-USDOT" || c.allowedToOperate === "N" ? "Yes" : "No",
        // ── Insurance Filings (from QCMobile) ──
        bipdInsuranceOnFile: c.bipdInsuranceOnFile || "",
        bipdInsuranceRequired: c.bipdInsuranceRequired || "",
        bipdRequiredAmount: c.bipdRequiredAmount != null ? String(c.bipdRequiredAmount) : "",
        cargoInsuranceOnFile: c.cargoInsuranceOnFile || "",
        cargoInsuranceRequired: c.cargoInsuranceRequired || "",
        bondInsuranceOnFile: c.bondInsuranceOnFile || "",
        bondInsuranceRequired: c.bondInsuranceRequired || "",
        // Cargo/commodity carried (array of cargo types)
        cargoCarried: Array.isArray(c.carrier?.cargoCarried) ? c.carrier.cargoCarried : [],
        source: "fmcsa",
      },
    });
  } catch (err) {
    console.error("[fmcsa] error:", String(err));
    return NextResponse.json({ carrier: null });
  }
}
