"use client";

import { useState, useRef, useEffect } from "react";
import { Box, Btn, RED, DARK } from "@/components/ui";

interface Step5Props {
  onNext: (data: Record<string, unknown>) => void;
  onBack: () => void;
  companyName: string;
}

export default function Step5({ onNext, onBack, companyName }: Step5Props) {
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
            <strong style={{ fontSize: 16 }}>CARRIER TRANSPORTATION AGREEMENT</strong>
            <br />
            <strong>Simon Express Logistics LLC — Freight Broker</strong>
            <br />
            <span style={{ fontSize: 12, color: "#888" }}>
              PO Box 1582, Riverton, UT 84065 | Phone: 801-260-7010 | Fax: 801-663-7537
            </span>
          </div>

          <p style={{ marginBottom: 10 }}>
            This Carrier Transportation Agreement (&quot;Agreement&quot;) is entered into by and between Simon Express Logistics LLC (&quot;BROKER&quot;), a duly licensed property broker under 49 C.F.R. Part 371, MC# 1003278, and the carrier identified in this onboarding application (&quot;CARRIER&quot;).
          </p>

          <p style={{ marginBottom: 10 }}><strong>1. INDEPENDENT CONTRACTOR.</strong> CARRIER is an independent contractor and is not an employee, partner, or agent of BROKER. CARRIER retains complete direction and control over the means, manner, and method of transportation. CARRIER acknowledges it has no authority to legally bind or obligate BROKER in any manner.</p>

          <p style={{ marginBottom: 10 }}><strong>2. REGULATORY COMPLIANCE.</strong> CARRIER warrants that it is, and will remain, duly and legally licensed and authorized to perform transportation services pursuant to applicable federal and state laws and regulations. CARRIER will provide evidence of operating authority as requested. CARRIER shall immediately notify BROKER of any revocation or suspension of its operating authority.</p>

          <p style={{ marginBottom: 10 }}><strong>3. SAFETY.</strong> CARRIER shall comply with all federal, state and local laws, rules, ordinances and regulations applicable to the transportation of freight, including but not limited to all laws and regulations related to hours of service, driver qualification, drug and alcohol testing, vehicle safety, and hazardous materials. CARRIER certifies that all drivers assigned to BROKER freight will be properly trained, licensed, and in compliance with DOT regulations.</p>

          <p style={{ marginBottom: 10 }}><strong>4. EXCLUSIVE USE OF CARRIER EQUIPMENT.</strong> The transportation services hereunder shall be performed using equipment that is exclusively operated under CARRIER&apos;s authority, owned or leased by CARRIER, and driven by CARRIER&apos;s employees or independent contractors who are properly enrolled in CARRIER&apos;s drug testing program. CARRIER shall ensure that all equipment used meets federal and state safety requirements.</p>

          <p style={{ marginBottom: 10 }}><strong>5. INDEMNIFICATION.</strong> CARRIER shall defend, indemnify and hold harmless BROKER, its officers, directors, employees and agents from any and all claims, losses, liabilities, damages, costs and expenses (including reasonable attorney&apos;s fees) arising from or related to: (a) CARRIER&apos;s negligence or willful misconduct; (b) CARRIER&apos;s breach of this Agreement; (c) personal injury or property damage caused by CARRIER; or (d) CARRIER&apos;s failure to comply with applicable laws and regulations.</p>

          <p style={{ marginBottom: 10 }}><strong>6. EXCLUSIVE CONTROL OF SHIPMENTS.</strong> CARRIER shall not sub-contract, broker, or arrange for the freight tendered by BROKER to be transported by a third party without the prior written consent of BROKER. CARRIER agrees that BROKER has the exclusive right to handle all billing of freight charges to the Customer.</p>

          <p style={{ marginBottom: 10 }}><strong>7. INSURANCE.</strong> CARRIER shall procure and maintain, at its sole cost and expense, the following insurance coverages:</p>
          <p style={{ marginBottom: 4, paddingLeft: 16 }}>a. Automobile liability insurance with a reputable insurance company in an amount not less than <strong>$1,000,000.00</strong> per occurrence.</p>
          <p style={{ marginBottom: 4, paddingLeft: 16 }}>b. All-risk broad-form Motor Truck Cargo Legal Liability insurance in an amount not less than <strong>$100,000.00</strong> per occurrence, naming CARRIER and BROKER as insureds.</p>
          <p style={{ marginBottom: 10, paddingLeft: 16 }}>c. Statutory Workers&apos; Compensation Insurance and Employer Liability coverage as required by applicable state law. CARRIER shall furnish written certifications from insurance carriers rated A- or better by A.M. Best, and shall provide at least thirty (30) days written notice of cancellation or modification.</p>

          <p style={{ marginBottom: 10 }}><strong>8. CARGO LIABILITY.</strong> CARRIER shall have the sole and exclusive care, custody and control of Customer&apos;s property from pickup until delivery. CARRIER assumes the liability of a common carrier (Carmack Amendment liability) for loss, delay, damage to or destruction of any and all Customer&apos;s goods or property while under CARRIER&apos;s care, custody or control. CARRIER shall pay to BROKER the Customer&apos;s full actual loss within thirty (30) days following receipt of BROKER&apos;s invoice and supporting documentation.</p>

          <p style={{ marginBottom: 10 }}><strong>9. WAIVER OF CARRIER&apos;S LIEN.</strong> CARRIER shall not withhold any goods of the Customer on account of any dispute as to rates or any alleged failure of BROKER to pay charges. CARRIER hereby waives and releases all liens which CARRIER might otherwise have to any goods of BROKER or its Customer in the possession or control of CARRIER.</p>

          <p style={{ marginBottom: 10 }}><strong>10. INVOICING AND PAYMENT.</strong> CARRIER will charge and BROKER will pay for transportation services at the rates shown on separate Rate Confirmation Sheets to be signed before each shipment. Standard payment terms are thirty (30) days within receipt by BROKER unless other terms are selected. CARRIER agrees that BROKER has the exclusive right to handle all billing of freight charges to the Customer.</p>

          <p style={{ marginBottom: 10 }}><strong>11. CONFIDENTIALITY AND NON-SOLICITATION.</strong> Neither party may disclose the terms of this Agreement to a third party without written consent. CARRIER will not solicit or obtain traffic from any shipper, consignor, consignee, or customer of BROKER where the availability of such traffic first became known to CARRIER as a result of BROKER&apos;s efforts. If CARRIER breaches this Agreement and directly or indirectly solicits traffic from customers of BROKER, CARRIER shall pay BROKER commission in the amount of thirty-five percent (35%) of the transportation revenue resulting from such traffic for a period of 15 months thereafter.</p>

          <p style={{ marginBottom: 10 }}><strong>12. SUB-CONTRACT PROHIBITION.</strong> CARRIER specifically agrees that all freight tendered to it by BROKER shall be transported on equipment operated only under the authority of CARRIER, and that CARRIER shall not sub-contract, broker, or arrange for the freight to be transported by a third party without the prior written consent of BROKER.</p>

          <p style={{ marginBottom: 10 }}><strong>13. ASSIGNMENT / MODIFICATION.</strong> This Agreement may not be assigned or transferred in whole or in part, and supersedes all other agreements and all tariffs, rates, classifications and schedules published, filed or otherwise maintained by CARRIER.</p>

          <p style={{ marginBottom: 10 }}><strong>14. SEVERABILITY.</strong> In the event that the operation of any portion of this Agreement results in violation of any law, the parties agree that such portion shall be severable and that the remaining provisions shall continue in full force and effect.</p>

          <p style={{ marginBottom: 10 }}><strong>15. WAIVER.</strong> CARRIER and Shipper expressly waive any and all rights and remedies allowed under 49 U.S.C. § 14101 to the extent that such rights and remedies conflict with this Agreement.</p>

          <p style={{ marginBottom: 16 }}><strong>16. DISPUTE RESOLUTION.</strong> This Agreement shall be deemed to have been drawn in accordance with the statutes and laws of the State of Utah and in the event of any disagreement or dispute, the laws of this state shall apply and suit must be brought in this state.</p>

          <div style={{ borderTop: "1.5px dashed #ddd", paddingTop: 12, marginBottom: 4 }}>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>BROKER — Simon Express Logistics LLC</p>
            <p style={{ marginBottom: 2 }}>By: Jason Fishback &nbsp;&nbsp; Title: Director of Operations</p>
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
