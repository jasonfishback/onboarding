import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Diagnostic endpoint: tests if GOOGLE_MAPS_API_KEY is set and if the key
// actually works against the Street View Metadata and Static Maps APIs.
// Returns JSON with diagnostics — call /api/test-maps?addr=1121+W+2100+S,+SOUTH+SALT+LAKE,+UT+84119
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const addr = searchParams.get("addr") || "1121 W 2100 S, SOUTH SALT LAKE, UT 84119";
  const gKey = process.env.GOOGLE_MAPS_API_KEY;

  const result: Record<string, unknown> = {
    keyConfigured: !!gKey,
    keyLength: gKey?.length ?? 0,
    keyPrefix: gKey ? gKey.slice(0, 8) + "..." : null,
    address: addr,
  };

  if (!gKey) {
    return NextResponse.json(result);
  }

  const encoded = encodeURIComponent(addr);

  // 1. Street View Metadata API — returns JSON with status
  try {
    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encoded}&key=${gKey}`;
    const metaRes = await fetch(metaUrl, { signal: AbortSignal.timeout(8000) });
    const metaJson = await metaRes.json();
    result.streetViewMetadata = {
      status: metaRes.status,
      body: metaJson,
    };
  } catch (e) {
    result.streetViewMetadata = { error: String(e) };
  }

  // 2. Static Maps API — fetch first few bytes to detect if image or error
  try {
    const staticUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encoded}&zoom=18&size=600x300&maptype=satellite&key=${gKey}`;
    const staticRes = await fetch(staticUrl, { signal: AbortSignal.timeout(8000) });
    const contentType = staticRes.headers.get("content-type") || "";
    result.staticMap = {
      status: staticRes.status,
      contentType,
    };
    if (!contentType.startsWith("image/")) {
      // Not an image — likely an error message
      result.staticMap = {
        ...result.staticMap as object,
        body: (await staticRes.text()).slice(0, 500),
      };
    }
  } catch (e) {
    result.staticMap = { error: String(e) };
  }

  // 3. Street View Static — same check
  try {
    const streetUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encoded}&fov=90&key=${gKey}`;
    const streetRes = await fetch(streetUrl, { signal: AbortSignal.timeout(8000) });
    const contentType = streetRes.headers.get("content-type") || "";
    result.streetViewStatic = {
      status: streetRes.status,
      contentType,
    };
    if (!contentType.startsWith("image/")) {
      result.streetViewStatic = {
        ...result.streetViewStatic as object,
        body: (await streetRes.text()).slice(0, 500),
      };
    }
  } catch (e) {
    result.streetViewStatic = { error: String(e) };
  }

  // URLs to share with user for direct testing
  result.testUrls = {
    streetView: `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encoded}&fov=90&key=${gKey.slice(0,6)}...`,
    satellite: `https://maps.googleapis.com/maps/api/staticmap?center=${encoded}&zoom=18&size=600x300&maptype=satellite&key=${gKey.slice(0,6)}...`,
  };

  return NextResponse.json(result, { status: 200 });
}
