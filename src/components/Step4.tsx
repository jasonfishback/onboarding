"use client";

import { useState, useRef } from "react";
import { Box, Btn, RED, DARK } from "@/components/ui";

interface Step4Props {
  onNext: (data: Record<string, unknown>) => void;
  onBack: () => void;
  carrier: Record<string, string> | null;
}

export default function Step4({ onNext, onBack, carrier }: Step4Props) {
  const [hasWC, setHasWC] = useState(false);
  const [wcUpload, setWCUpload] = useState<File | null>(null);
  const [exemptSigned, setExemptSigned] = useState(false);
  const [sigMode, setSigMode] = useState<"type" | "draw">("type");
  const [typeSig, setTypeSig] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const wcInputRef = useRef<HTMLInputElement>(null);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
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
    ctx.strokeStyle = DARK;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setLastPos(pos);
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const canContinue = hasWC ? !!wcUpload : exemptSigned && !!typeSig;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px", boxSizing: "border-box" as const, width: "100%" }}>
      <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>
        Step 4 of 5
      </div>
      <h2 style={{ fontFamily: "DM Sans", fontSize: 34, fontWeight: 700, marginBottom: 6 }}>
        Workers Compensation
      </h2>
      <p style={{ color: "#666", fontSize: 15, marginBottom: 24 }}>
        Utah law requires documentation of workers&apos; compensation coverage or a signed exemption.
      </p>

      {/* Toggle */}
      <Box style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontFamily: "DM Sans", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
          Do you have Workers&apos; Compensation insurance?
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            [true, "✓ Yes, I have WC insurance"],
            [false, "✗ No / Exempt"],
          ].map(([val, label]) => (
            <button
              key={String(val)}
              onClick={() => setHasWC(val as boolean)}
              style={{
                flex: 1,
                padding: "12px",
                border: "2px solid " + (hasWC === val ? (val ? "#22a355" : RED) : "#ccc"),
                background: hasWC === val ? (val ? "#f0faf4" : "#fff5f5") : "white",
                fontFamily: "DM Sans",
                fontSize: 15,
                fontWeight: 700,
                color: hasWC === val ? (val ? "#22a355" : RED) : "#666",
                borderRadius: 2,
                cursor: "pointer",
              }}
            >
              {label as string}
            </button>
          ))}
        </div>
      </Box>

      {hasWC && (
        <Box style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            Upload WC Certificate
          </div>
          <div
            onClick={() => wcInputRef.current?.click()}
            style={{
              border: wcUpload ? "2px solid #22a355" : "2px dashed #aaa",
              borderRadius: 2,
              padding: "24px",
              textAlign: "center",
              cursor: "pointer",
              background: wcUpload ? "#f0faf4" : "#fafaf8",
            }}
          >
            {wcUpload ? (
              <span style={{ color: "#22a355", fontSize: 17 }}>✓ {wcUpload.name}</span>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📋</div>
                <div style={{ fontSize: 16, color: "#555" }}>Click to upload your WC certificate</div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>PDF, JPG, PNG — max 10MB</div>
              </>
            )}
          </div>
          <input
            ref={wcInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setWCUpload(f); }}
          />
        </Box>
      )}

      {!hasWC && (
        <Box style={{ padding: 24, marginBottom: 24, borderColor: "#e6a020", boxShadow: "3px 3px 0 #e6a020" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div style={{ fontFamily: "DM Sans", fontSize: 20, fontWeight: 700 }}>Workers Compensation Exemption</div>
          </div>

          <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7, marginBottom: 16, background: "#fffbf0", border: "1.5px dashed #e6c060", borderRadius: 2, padding: 14 }}>
            <strong>WORKERS&apos; COMPENSATION EXEMPTION DECLARATION</strong>
            <br /><br />
            {carrier && (
              <div style={{ background: "white", border: "1.5px solid #ddd", borderRadius: 2, padding: "10px 14px", marginBottom: 12, color: "#333" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888", marginBottom: 6 }}>Carrier Information</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{(carrier as Record<string, string>).legalName || carrier.name || "—"}</div>
                <div style={{ fontSize: 13, marginTop: 2 }}>
                  {carrier.address}{carrier.city ? `, ${carrier.city}` : ""}{carrier.state ? `, ${carrier.state}` : ""}{carrier.zip ? ` ${carrier.zip}` : ""}
                </div>
                {(carrier.mc || carrier.dot) && (
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                    {carrier.mc ? `MC# ${carrier.mc}` : ""}{carrier.mc && carrier.dot ? "  |  " : ""}{carrier.dot ? `DOT# ${carrier.dot}` : ""}
                  </div>
                )}
              </div>
            )}
            I/We hereby declare that the carrier named herein is exempt from the workers&apos; compensation insurance requirements under the applicable state statutes for the following reason(s):
            <br /><br />
            ☐ &nbsp;Sole proprietor with no employees<br />
            ☐ &nbsp;All workers are independent contractors<br />
            ☐ &nbsp;Other statutory exemption<br /><br />
            I understand that by signing this form, I am certifying the accuracy of this information and agree to notify Simon Express immediately if my workers&apos; compensation status changes. I further agree to indemnify and hold harmless Simon Express from any claims arising from this exemption declaration.
          </div>

          {/* Signature */}
          <div style={{ fontFamily: "DM Sans", fontSize: 17, fontWeight: 700, marginBottom: 10 }}>
            Sign Exemption Form
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
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
                  fontSize: 15,
                  cursor: "pointer",
                  borderRadius: 2,
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {sigMode === "type" ? (
            <div>
              <input
                value={typeSig}
                onChange={(e) => setTypeSig(e.target.value)}
                placeholder="Type your full legal name..."
                style={{ width: "100%", padding: "12px", border: "2px solid " + DARK, fontFamily: "DM Sans", fontSize: 18, background: "#fafaf8", borderRadius: 2, outline: "none" }}
              />
              {typeSig && (
                <div style={{ padding: "10px 0 4px", fontFamily: "DM Sans", fontSize: 32, borderBottom: "2px solid " + DARK, color: "#222", marginTop: 8 }}>
                  {typeSig}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  Printed Name <span style={{ color: RED }}>*</span>
                </label>
                <input
                  value={typeSig}
                  onChange={(e) => setTypeSig(e.target.value)}
                  placeholder="Type full legal name..."
                  style={{ width: "100%", padding: "9px 12px", border: "2px solid " + DARK, borderRadius: 2, fontFamily: "DM Sans", fontSize: 14, background: "#fafaf8", outline: "none" }}
                />
              </div>
              <canvas
                ref={canvasRef}
                width={560}
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

          {typeSig && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 16, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={exemptSigned}
                onChange={(e) => setExemptSigned(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 2, accentColor: RED }}
              />
              <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6 }}>
                I certify that the above information is true and correct and that I am authorized to sign this exemption declaration on behalf of the named carrier.
              </div>
            </label>
          )}
        </Box>
      )}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn
          disabled={!canContinue}
          onClick={() => onNext({ hasWC, wcUpload: wcUpload?.name, exemptSigned, signerName: typeSig })}
        >
          Continue →
        </Btn>
      </div>
    </div>
  );
}
