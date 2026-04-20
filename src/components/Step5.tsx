"use client";

import { useState, useRef, useEffect } from "react";
import { Box, Btn, RED, DARK } from "@/components/ui";

interface Step5Props {
  onNext: (data: Record<string, unknown>) => void;
  onBack: () => void;
  companyName: string;
  companyData?: Record<string, unknown>;
}

export default function Step5({ onNext, onBack, companyName, companyData }: Step5Props) {
  const [scrolled, setScrolled] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [sigMode, setSigMode] = useState<"type" | "draw">("type");
  const [typeSig, setTypeSig] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setScrolled(true);
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const r = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    setDrawing(true);
    setLastPos(getPos(e, canvasRef.current));
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing || !lastPos || !canvasRef.current) return;
    const pos = getPos(e, canvasRef.current);
    const ctx = canvasRef.current.getContext("2d")!;
    ctx.strokeStyle = DARK; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(lastPos.x, lastPos.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    setLastPos(pos);
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    canvasRef.current.getContext("2d")!.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const canSign = agreed && typeSig.length > 2;
  const today = new Date().toLocaleDateString();

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 20px", boxSizing: "border-box" as const, width: "100%" }}>
      <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>
        Step 5 of 5
      </div>
      <h2 style={{ fontFamily: "DM Sans", fontSize: 34, fontWeight: 700, marginBottom: 6 }}>Carrier Agreement</h2>
      <p style={{ color: "#666", fontSize: 15, marginBottom: 20 }}>
        Please read the full agreement before signing.
      </p>

      <Box style={{ padding: 0, marginBottom: 20, overflow: "hidden" }}>
        <div
          ref={scrollRef}
          style={{ height: 420, overflowY: "auto", padding: "20px 24px", fontSize: 13, lineHeight: 1.8, color: "#333" }}
        >
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <strong style={{ fontSize: 16 }}>BROKER-CARRIER TRANSPORTATION SERVICES AGREEMENT</strong>
            <br />
            <strong>Simon Express Logistics LLC — Freight Broker</strong>
            <br />
            <span style={{ fontSize: 12, color: "#888" }}>
              PO Box 1582, Riverton, UT 84065 | Phone: 801-260-7010 | Fax: 801-663-7537
            </span>
          </div>

          <p style={{ marginBottom: 10 }}>
            This BROKER-CARRIER Transportation Services Agreement (&quot;Agreement&quot;) is entered into by and between{" "}
            <strong>Simon Express Logistics LLC (&quot;BROKER&quot;)</strong>, PO Box 1582, Riverton, Utah 84065 (MC# 077997-B), and{" "}
            <strong>{companyName} (&quot;CARRIER&quot;)</strong>
            {(companyData?.mc || companyData?.dot) && (
              <> ({companyData?.mc ? `MC# ${companyData.mc}` : `DOT# ${companyData.dot}`})</>
            )}
            {(companyData?.address || companyData?.city) && (
              <>, with principal offices located at {[companyData?.address, companyData?.city, companyData?.state, companyData?.zip].filter(Boolean).join(", ")}</>
            )}.
          </p>

          <p style={{ marginBottom: 10 }}><strong>1. TERM.</strong> The Term of this Agreement shall be for one (1) year and shall automatically renew for successive one (1) year periods; provided, however, that this Agreement may be terminated at any time by giving thirty (30) days prior written notice.</p>

          <p style={{ marginBottom: 10 }}><strong>2. CARRIER&apos;S OPERATING AUTHORITY AND COMPLIANCE WITH LAW.</strong> CARRIER represents and warrants that it is duly and legally qualified to provide, as a contract carrier, the transportation services contemplated herein. CARRIER further agrees to notify BROKER within twenty-four (24) hours of receiving a conditional or unsatisfactory Safety Rating from the DOT.</p>

          <p style={{ marginBottom: 10 }}><strong>3. PERFORMANCE OF SERVICES.</strong> CARRIER shall transport all shipments provided under this Agreement without delay, and all occurrences which would be probable or certain to cause delay shall be immediately communicated to BROKER by CARRIER. This Agreement does not grant CARRIER an exclusive right to perform transportation services for BROKER or its Customer.</p>

          <p style={{ marginBottom: 10 }}><strong>4. RECEIPTS AND BILLS OF LADING.</strong> Each shipment hereunder shall be evidenced by a Uniform (Standard) Bill of Lading naming CARRIER as the transporting carrier. CARRIER shall immediately forward freight bills together with any proof of delivery to BROKER.</p>

          <p style={{ marginBottom: 10 }}><strong>5. RATES AND ACCESSORIALS.</strong> Rates are established by separate Rate Confirmation Sheet for each load. Any accessorial charges not agreed to prior to loading will not be recognized or paid by BROKER. The Rate Confirmation Sheet is incorporated into and made a part of this Agreement.</p>

          <p style={{ marginBottom: 10 }}><strong>6. INVOICING AND PAYMENT.</strong> Standard payment terms are net thirty (30) days within receipt by BROKER. CARRIER agrees that BROKER has the exclusive right to handle all billing of freight charges to the Customer, and CARRIER agrees to refrain from all collection efforts against the shipper, receiver, consignor, consignee or Customer.</p>

          <p style={{ marginBottom: 10 }}><strong>7. INDEPENDENT CONTRACTOR.</strong> CARRIER is an independent contractor and is not an employee, partner, or joint venturer of BROKER. CARRIER shall be solely responsible for the payment of all federal, state and local taxes owed in connection with compensation paid under this Agreement.</p>

          <p style={{ marginBottom: 10 }}><strong>8. INSURANCE.</strong> CARRIER shall procure and maintain: (a) Automobile liability — not less than $1,000,000.00 per occurrence; (b) Motor Truck Cargo Legal Liability — not less than $100,000.00 per occurrence; (c) Statutory Workers&apos; Compensation as required by applicable state law; (d) General Liability — not less than $1,000,000.00 per occurrence. CARRIER shall provide at least thirty (30) days prior written notice of cancellation or material modification.</p>

          <p style={{ marginBottom: 10 }}><strong>9. CARGO LIABILITY.</strong> CARRIER assumes the liability of a common carrier for loss, delay, damage to or destruction of any goods while in CARRIER&apos;s care, custody or control. CARRIER shall pay BROKER the Customer&apos;s full actual loss within thirty (30) days following receipt of BROKER&apos;s written claim and supporting documentation.</p>

          <p style={{ marginBottom: 10 }}><strong>10. WAIVER OF LIEN.</strong> CARRIER shall not withhold delivery of any goods on account of any dispute as to rates or alleged failure of BROKER to pay charges. CARRIER hereby waives and releases all liens to any goods of BROKER or its Customer.</p>

          <p style={{ marginBottom: 10 }}><strong>11. INDEMNIFICATION.</strong> CARRIER shall defend, indemnify, and hold harmless BROKER and its officers, directors, employees, and agents from and against any and all claims, damages, losses, costs and expenses, including reasonable attorneys&apos; fees, arising out of or resulting from any negligent or wrongful act of CARRIER, breach of this Agreement, or violation of applicable law.</p>

          <p style={{ marginBottom: 10 }}><strong>12. CONFIDENTIALITY AND NON-SOLICITATION.</strong> CARRIER shall not directly solicit or accept freight from any shipper or consignee introduced through BROKER for a period of twelve (12) months following termination. In the event of breach, CARRIER shall pay BROKER a commission of thirty-five percent (35%) of the gross revenue generated from such traffic for fifteen (15) months.</p>

          <p style={{ marginBottom: 10 }}><strong>13. SUBCONTRACTING.</strong> CARRIER shall not subcontract, broker, or co-broker any shipment tendered by BROKER without prior written consent. CARRIER shall be responsible for the acts and omissions of any subcontractor.</p>

          <p style={{ marginBottom: 10 }}><strong>14. COMPLIANCE WITH LAWS.</strong> CARRIER shall comply with all federal, state and local laws and regulations applicable to the transportation services hereunder, including the Federal Motor Carrier Safety Regulations (49 C.F.R. Parts 300–399) and all applicable environmental laws.</p>

          <p style={{ marginBottom: 10 }}><strong>15. ASSIGNMENT.</strong> This Agreement may not be assigned or transferred, in whole or in part, by either party without prior written consent. Any attempted assignment in violation of this section shall be null and void.</p>

          <p style={{ marginBottom: 10 }}><strong>16. SEVERABILITY.</strong> In the event that any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.</p>

          <p style={{ marginBottom: 10 }}><strong>17. WAIVER.</strong> Failure of either party to enforce any provision shall not be construed as a waiver. CARRIER and BROKER expressly waive any rights and remedies to the extent they conflict with this Agreement, including those under 49 U.S.C. § 14101.</p>

          <p style={{ marginBottom: 10 }}><strong>18. ENTIRE AGREEMENT AND MODIFICATION.</strong> This Agreement, together with all Rate Confirmation Sheets, constitutes the entire agreement between the parties and supersedes all prior agreements. This Agreement may only be modified by a written instrument signed by authorized representatives of both parties.</p>

          <p style={{ marginBottom: 16 }}><strong>19. GOVERNING LAW AND DISPUTE RESOLUTION.</strong> This Agreement shall be governed by the laws of the State of Utah. Any dispute shall be resolved in the state or federal courts located in Salt Lake County, Utah, and the parties hereby consent to the personal jurisdiction of such courts.</p>

          <div style={{ borderTop: "1.5px dashed #ddd", paddingTop: 12, marginBottom: 4 }}>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>BROKER — Simon Express Logistics LLC</p>
            <p style={{ marginBottom: 2 }}>By: Jason Fishback &nbsp;&nbsp; Title: VP of Operations</p>
            <p style={{ marginBottom: 2 }}>Address: PO Box 1582, Riverton, UT 84065</p>
            <p>Phone: 801-260-7010 &nbsp;&nbsp; Fax: 801-663-7537</p>
          </div>
          <div style={{ textAlign: "center", color: "#aaa", fontSize: 13, marginTop: 16 }}>
            — Scroll to bottom to enable signature —
          </div>
        </div>
        {!scrolled && (
          <div style={{ textAlign: "center", padding: "6px 0 10px", fontSize: 12, color: "#aaa" }}>
            ↓ Scroll down to read full agreement
          </div>
        )}
      </Box>

      {scrolled && (
        <>
          <Box style={{ padding: 20, marginBottom: 20 }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ width: 20, height: 20, marginTop: 2, accentColor: RED, flexShrink: 0 }}
              />
              <div style={{ fontSize: 14, color: "#444", lineHeight: 1.6 }}>
                I have read and agree to the Simon Express Carrier Transportation Agreement. I confirm that all information provided is accurate and that I am authorized to enter into this agreement on behalf of{" "}
                <strong>{companyName || "the carrier"}</strong>.
              </div>
            </label>
          </Box>

          {agreed && (
            <Box style={{ padding: 24, marginBottom: 24 }}>
              <div style={{ fontFamily: "DM Sans", fontSize: 20, fontWeight: 700, marginBottom: 14 }}>
                Electronic Signature
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {(
                  [
                    ["type", "✏️ Type Signature"],
                    ["draw", "🖊 Draw Signature"],
                  ] as const
                ).map(([m, l]) => (
                  <button
                    key={m}
                    onClick={() => setSigMode(m)}
                    style={{
                      padding: "8px 16px",
                      border: "2px solid " + (sigMode === m ? DARK : "#ccc"),
                      background: sigMode === m ? "#f0eeea" : "white",
                      fontFamily: "DM Sans",
                      fontSize: 16,
                      cursor: "pointer",
                      borderRadius: 2,
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  Full Legal Name <span style={{ color: RED }}>*</span>
                </label>
                <input
                  value={typeSig}
                  onChange={(e) => setTypeSig(e.target.value)}
                  placeholder="Type your full legal name..."
                  style={{ width: "100%", padding: "12px", border: "2px solid " + DARK, fontFamily: "DM Sans", fontSize: 18, background: "#fafaf8", borderRadius: 2, outline: "none" }}
                />
                {sigMode === "type" && typeSig && (
                  <div style={{ padding: "10px 0 4px", fontFamily: "DM Sans", fontSize: 32, borderBottom: "2px solid " + DARK, color: "#222", marginTop: 8 }}>
                    {typeSig}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  Your Title / Role
                </label>
                <input
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  placeholder="e.g. Owner, President, Dispatch Manager"
                  style={{ width: "100%", padding: "9px 12px", border: "2px solid " + DARK, borderRadius: 2, fontFamily: "DM Sans", fontSize: 14, background: "#fafaf8", outline: "none" }}
                />
              </div>

              {sigMode === "draw" && (
                <div>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                    Draw your signature below
                  </label>
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={110}
                    style={{ border: "2px solid " + DARK, borderRadius: 2, background: "white", cursor: "crosshair", width: "100%", touchAction: "none" }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={() => setDrawing(false)}
                    onMouseLeave={() => setDrawing(false)}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={() => setDrawing(false)}
                  />
                  <button
                    onClick={clearCanvas}
                    style={{ marginTop: 6, fontFamily: "DM Sans", fontSize: 14, color: "#888", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Clear
                  </button>
                </div>
              )}

              <div style={{ fontSize: 11, color: "#aaa", marginTop: 10 }}>
                By signing, you agree that this electronic signature is legally binding. Date: {today}
              </div>
            </Box>
          )}
        </>
      )}

      {/* Validation error */}
      {!canSign && (
        <div style={{ color: "#CC1B1B", fontSize: 13, fontWeight: 600, textAlign: "center", marginBottom: 6 }}>
          {!agreed && !scrolled
            ? "Scroll through the full agreement to continue"
            : !agreed
              ? "Check the box to agree to the terms above"
              : "Enter your name in the signature field above (min. 3 characters)"}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn
          disabled={!canSign}
          onClick={() => {
            // Capture drawn signature as base64 if in draw mode
            let signatureImage: string | undefined;
            if (sigMode === "draw" && canvasRef.current) {
              const ctx = canvasRef.current.getContext("2d");
              if (ctx) {
                // Check if canvas has content (not blank)
                const data = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
                const hasContent = data.data.some((v, i) => i % 4 !== 3 && v !== 0);
                if (hasContent) signatureImage = canvasRef.current.toDataURL("image/png");
              }
            }
            onNext({ agreed, signerName: typeSig, signerTitle, sigDate: today, signatureImage });
          }}
        >
          Submit Application →
        </Btn>
      </div>
    </div>
  );
}
