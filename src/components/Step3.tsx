"use client";

import { useState, useRef, useEffect } from "react";
import { Box, Btn, SketchInput, SketchSelect, RED, DARK } from "@/components/ui";

interface Step3Props {
  onNext: (data: Record<string, unknown>) => void;
  onBack: () => void;
  companyName: string;
}

// Generate a session ID once per browser session
function getSessionId(): string {
  let sid = sessionStorage.getItem("onboarding_session");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("onboarding_session", sid);
  }
  return sid;
}

const FILE_LABELS: Record<string, string> = {
  w9: "W-9 Tax Form",
  ins: "Certificate of Insurance",
  auth: "Authority Letter (MC)",
  factoring: "Factoring Letter / NOA",
  check: "Voided Check / ACH Info",
};

function UploadBox({
  label,
  hint,
  optional = true,
  fileKey,
  uploaded,
  uploading,
  onUpload,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  fileKey: string;
  uploaded?: File | null;
  uploading?: boolean;
  onUpload: (file: File, key: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: "DM Sans", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
        {label}{" "}
        {optional && <span style={{ fontSize: 13, fontWeight: 400, color: "#888" }}>(optional)</span>}
      </div>
      {hint && <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{hint}</div>}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          border: uploaded ? "2px solid #22a355" : uploading ? "2px solid #4a90e2" : "2px dashed #aaa",
          borderRadius: 2,
          padding: "18px 16px",
          textAlign: "center",
          cursor: uploading ? "wait" : "pointer",
          background: uploaded ? "#f0faf4" : uploading ? "#f0f6ff" : "#fafaf8",
          transition: "all .2s",
        }}
      >
        {uploading ? (
          <span style={{ color: "#4a90e2", fontFamily: "DM Sans", fontSize: 16 }}>⏳ Uploading...</span>
        ) : uploaded ? (
          <span style={{ color: "#22a355", fontFamily: "DM Sans", fontSize: 16 }}>✓ {uploaded.name}</span>
        ) : (
          <>
            <div style={{ fontSize: 22, marginBottom: 4 }}>📎</div>
            <div style={{ fontFamily: "DM Sans", fontSize: 16, color: "#555" }}>Click to upload or drag & drop</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>PDF, JPG, PNG — max 10MB</div>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file, fileKey);
        }}
      />
    </div>
  );
}

export default function Step3({ onNext, onBack, companyName }: Step3Props) {
  const [sessionId] = useState(() => {
    if (typeof window !== "undefined") return getSessionId();
    return crypto.randomUUID();
  });

  const [uploads, setUploads] = useState<Record<string, File | null>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

  const [w9Mode, setW9Mode] = useState<"upload" | "fill">("upload");
  const [w9Form, setW9Form] = useState({
    name: "", ssn: "", address: "", city: "", state: "", zip: "", classif: "individual",
  });
  const [agentEmail, setAgentEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  const setW9 = (k: string) => (v: string) => setW9Form((f) => ({ ...f, [k]: v }));

  // Upload file to server
  const handleUpload = async (file: File, key: string) => {
    setUploads((u) => ({ ...u, [key]: file }));
    setUploading((u) => ({ ...u, [key]: true }));
    setUploadErrors((e) => ({ ...e, [key]: "" }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileKey", key);
      formData.append("sessionId", sessionId);
      formData.append("label", FILE_LABELS[key] || key);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!data.success) {
        setUploadErrors((e) => ({ ...e, [key]: data.error || "Upload failed" }));
        setUploads((u) => ({ ...u, [key]: null }));
      }
    } catch (err) {
      setUploadErrors((e) => ({ ...e, [key]: "Upload failed — please try again" }));
      setUploads((u) => ({ ...u, [key]: null }));
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  };

  const sendAgentEmail = async () => {
    if (!agentEmail) return;
    setEmailSending(true);
    try {
      await fetch("/api/send-agent-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentEmail, companyName }),
      });
      setEmailSent(true);
    } catch {
      setEmailSent(true);
    } finally {
      setEmailSending(false);
    }
  };

  const w9Complete = uploads["w9"] || (w9Mode === "fill" && w9Form.name && w9Form.ssn);
  const coiComplete = uploads["ins"] || emailSent;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px", boxSizing: "border-box" as const, width: "100%" }}>
      <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>
        Step 3 of 5
      </div>
      <h2 style={{ fontFamily: "DM Sans", fontSize: 34, fontWeight: 700, marginBottom: 4 }}>Documents & W-9</h2>
      <p style={{ color: "#666", fontSize: 15, marginBottom: 24 }}>
        Upload your documents — they&apos;ll be processed and included in your onboarding packet automatically.
      </p>

      {/* W-9 */}
      <Box style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontFamily: "DM Sans", fontSize: 20, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: "1.5px dashed #ddd" }}>
          W-9 / Tax Information
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {([["upload", "📎 Upload W-9"], ["fill", "✏️ Fill Out W-9 Online"]] as const).map(([m, label]) => (
            <button key={m} onClick={() => setW9Mode(m)}
              style={{ flex: 1, padding: "10px 8px", border: "2px solid " + (w9Mode === m ? RED : "#ccc"), background: w9Mode === m ? "#fff5f5" : "white", fontFamily: "DM Sans", fontSize: 16, fontWeight: 700, color: w9Mode === m ? RED : "#666", borderRadius: 2, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {w9Mode === "upload" ? (
          <>
            <UploadBox label="W-9 Form" hint="Signed W-9 tax form" optional={false} fileKey="w9"
              uploaded={uploads["w9"]} uploading={uploading["w9"]} onUpload={handleUpload} />
            {uploadErrors["w9"] && <div style={{ color: RED, fontSize: 12, marginTop: -8, marginBottom: 8 }}>⚠ {uploadErrors["w9"]}</div>}
          </>
        ) : (
          <div style={{ border: "1.5px dashed #ccc", borderRadius: 2, padding: 20, background: "#fafaf8" }}>
            <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "#666", marginBottom: 14 }}>W-9 Online Form</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div style={{ gridColumn: "1/-1" }}>
                <SketchInput label="Legal Name (as shown on tax return)" value={w9Form.name} onChange={setW9("name")} required />
              </div>
              <SketchInput label="SSN or EIN" value={w9Form.ssn} onChange={setW9("ssn")} placeholder="XX-XXXXXXX" required />
              <SketchSelect label="Federal Tax Classification" value={w9Form.classif} onChange={setW9("classif")} options={[
                { value: "individual", label: "Individual / Sole Proprietor" },
                { value: "llc_s", label: "LLC (S-Corp)" },
                { value: "llc_c", label: "LLC (C-Corp)" },
                { value: "corp", label: "C Corporation" },
                { value: "partner", label: "Partnership" },
              ]} />
              <div style={{ gridColumn: "1/-1" }}>
                <SketchInput label="Street Address or PO Box" value={w9Form.address} onChange={setW9("address")} />
              </div>
              <SketchInput label="City" value={w9Form.city} onChange={setW9("city")} />
              <SketchInput label="State" value={w9Form.state} onChange={setW9("state")} placeholder="UT" />
              <SketchInput label="ZIP Code" value={w9Form.zip} onChange={setW9("zip")} />
            </div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 8 }}>W-9 info will be included in your onboarding packet.</div>
          </div>
        )}
      </Box>

      {/* Supporting Docs */}
      <Box style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ fontFamily: "DM Sans", fontSize: 20, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: "1.5px dashed #ddd" }}>
          Supporting Documents
        </div>

        <UploadBox label="Certificate of Insurance" hint="COI naming Simon Express as certificate holder — PO Box 1582, Riverton, UT 84065"
          optional={false} fileKey="ins" uploaded={uploads["ins"]} uploading={uploading["ins"]} onUpload={handleUpload} />
        {uploadErrors["ins"] && <div style={{ color: RED, fontSize: 12, marginTop: -8, marginBottom: 8 }}>⚠ {uploadErrors["ins"]}</div>}

        {/* Insurance Agent Email */}
        <div style={{ marginBottom: 20, padding: 16, background: "#f8f8f6", border: "1.5px dashed #ccc", borderRadius: 2 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Have your agent send the COI directly</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>Enter your agent&apos;s email and we&apos;ll send them a COI request, CC&apos;d to dispatch@simonexpress.com.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={agentEmail} onChange={(e) => { setAgentEmail(e.target.value); setEmailSent(false); }}
              placeholder="agent@insurancecompany.com"
              style={{ flex: 1, padding: "9px 12px", border: "2px solid " + DARK, borderRadius: 2, fontFamily: "DM Sans", fontSize: 14, background: "white", outline: "none" }} />
            <Btn onClick={sendAgentEmail} disabled={!agentEmail || emailSending} variant="secondary" style={{ padding: "9px 18px", fontSize: 15 }}>
              {emailSending ? "Sending..." : emailSent ? "✓ Sent!" : "Send Request"}
            </Btn>
          </div>
          {emailSent && (
            <div style={{ marginTop: 10, padding: "10px 14px", background: "#edfaf3", border: "1.5px solid #22a355", borderRadius: 2, fontSize: 13 }}>
              <strong style={{ color: "#22a355" }}>✓ Request sent to {agentEmail}</strong><br />
              <span style={{ color: "#555" }}>CC: dispatch@simonexpress.com</span>
            </div>
          )}
        </div>

        {[
          ["auth", "Authority Letter (MC)", "FMCSA operating authority letter"],
          ["factoring", "Factoring Letter / NOA", "Notice of Assignment if you use a factoring company"],
          ["check", "Voided Check / ACH Info", "For direct deposit payment setup"],
        ].map(([key, label, hint]) => (
          <div key={key}>
            <UploadBox label={label} hint={hint} optional fileKey={key}
              uploaded={uploads[key]} uploading={uploading[key]} onUpload={handleUpload} />
            {uploadErrors[key] && <div style={{ color: RED, fontSize: 12, marginTop: -8, marginBottom: 8 }}>⚠ {uploadErrors[key]}</div>}
          </div>
        ))}
      </Box>

      {(!w9Complete || !coiComplete) && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "#fff5f5", border: "1.5px solid #ffaaaa", borderRadius: 2, fontSize: 13, color: RED, fontWeight: 600, lineHeight: 1.7 }}>
          {!w9Complete && <div>⚠ A completed W-9 is required — upload one or fill it out online above.</div>}
          {!coiComplete && <div>⚠ Certificate of Insurance is required — upload a COI or send a request to your agent above.</div>}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn
          onClick={() => onNext({
            sessionId,
            uploads: Object.fromEntries(Object.entries(uploads).filter(([, v]) => v).map(([k, v]) => [k, v?.name])),
            w9Mode, w9Form, agentEmail, emailSent,
          })}
          disabled={!w9Complete || !coiComplete}
        >
          Continue →
        </Btn>
      </div>
    </div>
  );
}
