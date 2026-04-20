"use client";

import { useState } from "react";
import { Box, Btn, SketchInput, SketchSelect, RED, DARK } from "@/components/ui";
import type { CarrierData } from "./Step1";

interface ContactData {
  name: string;
  title: string;
  phone: string;
  email: string;
}

interface Step2Props {
  prefill: CarrierData | null;
  onNext: (data: Record<string, unknown>) => void;
  onBack: () => void;
}

function ContactSection({
  title,
  data,
  setData,
  primaryContact,
  showCopy,
}: {
  title: string;
  data: ContactData;
  setData: React.Dispatch<React.SetStateAction<ContactData>>;
  primaryContact: { contactName: string; contactTitle: string; phone: string; email: string };
  showCopy?: boolean;
}) {
  const copyFromPrimary = () =>
    setData({
      name: primaryContact.contactName,
      title: primaryContact.contactTitle,
      phone: primaryContact.phone,
      email: primaryContact.email,
    });

  return (
    <Box style={{ padding: 24, marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          paddingBottom: 8,
          borderBottom: "1.5px dashed #ddd",
        }}
      >
        <div style={{ fontFamily: "DM Sans", fontSize: 20, fontWeight: 700 }}>
          {title}
        </div>
        {showCopy && (
          <button
            onClick={copyFromPrimary}
            style={{
              fontFamily: "DM Sans",
              fontSize: 13,
              fontWeight: 600,
              color: RED,
              background: "#fff5f5",
              border: "1.5px solid " + RED,
              borderRadius: 2,
              padding: "5px 12px",
              cursor: "pointer",
            }}
          >
            ⬆ Copy from Primary Contact
          </button>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0 16px",
        }}
      >
        <SketchInput
          label="Contact Name"
          value={data.name}
          onChange={(v) => setData((d) => ({ ...d, name: v }))}
          required
        />
        <SketchInput
          label="Title / Role"
          value={data.title}
          onChange={(v) => setData((d) => ({ ...d, title: v }))}
          placeholder="Owner, Dispatch, etc."
        />
        <SketchInput
          label="Phone"
          value={data.phone}
          onChange={(v) => setData((d) => ({ ...d, phone: v }))}
          required
        />
        <SketchInput
          label="Email"
          value={data.email}
          onChange={(v) => setData((d) => ({ ...d, email: v }))}
          required
        />
      </div>
    </Box>
  );
}

export default function Step2({ prefill, onNext, onBack }: Step2Props) {
  const [form, setForm] = useState({
    legalName: prefill?.name || "",
    dba: "",
    address: prefill?.address || "",
    city: prefill?.city || "",
    state: prefill?.state || "",
    zip: prefill?.zip || "",
    phone: prefill?.phone || "",
    email: prefill?.email || "",
    contactName: "",
    contactTitle: "",
    mc: prefill?.mc || "",
    dot: prefill?.dot || "",
    type: prefill?.type || "Motor Carrier",
    ein: "",
    truckCount: "",
    trailerCount: "",
    trailerTypes: { reefer: false, van: false, flatbed: false },
  });

  const set = (k: string) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleTrailer = (t: "reefer" | "van" | "flatbed") =>
    setForm((f) => ({
      ...f,
      trailerTypes: { ...f.trailerTypes, [t]: !f.trailerTypes[t] },
    }));

  const [dispatch, setDispatch] = useState<ContactData>({ name: "", title: "", phone: "", email: "" });
  const [billing, setBilling] = useState<ContactData>({ name: "", title: "", phone: "", email: "" });
  const [diffMailing, setDiffMailing] = useState(false);
  const [mailing, setMailing] = useState({ address: "", city: "", state: "", zip: "" });
  const setMail = (k: string) => (v: string) =>
    setMailing((m) => ({ ...m, [k]: v }));
  const [usesFactoring, setUsesFactoring] = useState(false);
  const [factoringName, setFactoringName] = useState("");
  const [wantsQuickPay, setWantsQuickPay] = useState(false);

  const handleNext = () => {
    onNext({
      ...form,
      dispatch,
      billing,
      mailing: diffMailing ? mailing : null,
      usesFactoring,
      factoringName,
      wantsQuickPay,
    });
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px", boxSizing: "border-box", width: "100%" }}>
      <div
        style={{
          fontFamily: "DM Sans",
          fontSize: 13,
          fontWeight: 700,
          color: RED,
          textTransform: "uppercase",
          letterSpacing: ".1em",
          marginBottom: 6,
        }}
      >
        Step 2 of 5
      </div>
      <h2
        style={{ fontFamily: "DM Sans", fontSize: 34, fontWeight: 700, marginBottom: 6 }}
      >
        Company Profile
      </h2>
      {prefill && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#edfaf3",
            border: "1.5px solid #22a355",
            borderRadius: 2,
            padding: "5px 12px",
            marginBottom: 20,
            fontSize: 13,
            color: "#22a355",
            fontWeight: 600,
          }}
        >
          ✓ Pre-filled from FMCSA — please verify and complete
        </div>
      )}

      {/* Company Info */}
      <Box style={{ padding: 24, marginBottom: 16, overflow: "hidden" }}>
        <div
          style={{
            fontFamily: "DM Sans",
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 16,
            paddingBottom: 8,
            borderBottom: "1.5px dashed #ddd",
          }}
        >
          Company Information
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div style={{ gridColumn: "1/-1" }}>
            <SketchInput label="Legal Company Name" value={form.legalName} onChange={set("legalName")} required />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <SketchInput label="DBA / Trade Name" value={form.dba} onChange={set("dba")} placeholder="If different from legal name" />
          </div>
          <SketchInput label="MC Number" value={form.mc} onChange={set("mc")} placeholder="MC123456" required />
          <SketchInput label="DOT Number" value={form.dot} onChange={set("dot")} placeholder="9876543" />
          <SketchInput label="EIN / Tax ID" value={form.ein} onChange={set("ein")} placeholder="XX-XXXXXXX" required />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
            <SketchInput label="# of Trucks" value={form.truckCount} onChange={set("truckCount")} placeholder="e.g. 5" required />
            <SketchInput label="# of Trailers" value={form.trailerCount} onChange={set("trailerCount")} placeholder="e.g. 8" required />
          </div>
        </div>

        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            Trailer Types <span style={{ color: RED }}>*</span>
            <span style={{ fontSize: 12, fontWeight: 400, color: "#888", marginLeft: 6 }}>
              Select all that apply
            </span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {(
              [
                ["reefer", "❄️", "Reefer"],
                ["van", "📦", "Dry Van"],
                ["flatbed", "🚛", "Flatbed"],
              ] as const
            ).map(([key, icon, name]) => (
              <div
                key={key}
                onClick={() => toggleTrailer(key)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px 10px",
                  border: "2px solid " + (form.trailerTypes[key] ? RED : "#ccc"),
                  background: form.trailerTypes[key] ? "#fff5f5" : "white",
                  borderRadius: 2,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  color: form.trailerTypes[key] ? RED : "#555",
                  transition: "all .15s",
                  boxShadow: form.trailerTypes[key] ? "2px 2px 0 " + RED : "none",
                  userSelect: "none",
                }}
              >
                <span style={{ fontSize: 20 }}>{icon}</span>
                {name}
              </div>
            ))}
          </div>
        </div>
      </Box>

      {/* Address */}
      <Box style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontFamily: "DM Sans", fontSize: 20, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: "1.5px dashed #ddd" }}>
          Address
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div style={{ gridColumn: "1/-1" }}>
            <SketchInput label="Street Address" value={form.address} onChange={set("address")} required />
          </div>
          <SketchInput label="City" value={form.city} onChange={set("city")} required />
          <SketchInput label="State" value={form.state} onChange={set("state")} placeholder="UT" />
          <SketchInput label="ZIP Code" value={form.zip} onChange={set("zip")} required />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: 8 }}>
          <input
            type="checkbox"
            checked={diffMailing}
            onChange={(e) => setDiffMailing(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: RED }}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#444" }}>Different mailing address</span>
        </label>

        {diffMailing && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1.5px dashed #ddd" }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#888", marginBottom: 10 }}>
              Mailing Address
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div style={{ gridColumn: "1/-1" }}>
                <SketchInput label="Street Address" value={mailing.address} onChange={setMail("address")} required />
              </div>
              <SketchInput label="City" value={mailing.city} onChange={setMail("city")} required />
              <SketchInput label="State" value={mailing.state} onChange={setMail("state")} placeholder="UT" />
              <SketchInput label="ZIP Code" value={mailing.zip} onChange={setMail("zip")} required />
            </div>
          </div>
        )}
      </Box>

      {/* Primary Contact */}
      <Box style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontFamily: "DM Sans", fontSize: 20, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: "1.5px dashed #ddd" }}>
          Primary Contact
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <SketchInput label="Contact Name" value={form.contactName} onChange={set("contactName")} required />
          <SketchInput label="Title / Role" value={form.contactTitle} onChange={set("contactTitle")} placeholder="Owner, Dispatch, etc." />
          <SketchInput label="Phone" value={form.phone} onChange={set("phone")} required />
          <SketchInput label="Email" value={form.email} onChange={set("email")} required />
        </div>
      </Box>

      <ContactSection
        title="Dispatch Contact"
        data={dispatch}
        setData={setDispatch}
        primaryContact={form}
        showCopy
      />
      <ContactSection
        title="Billing Contact"
        data={billing}
        setData={setBilling}
        primaryContact={form}
        showCopy
      />

      {/* Factoring & Quick Pay */}
      <Box style={{ padding: 24, marginBottom: 24 }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={usesFactoring}
            onChange={(e) => setUsesFactoring(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 2, accentColor: RED, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>I use a factoring company</div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
              Check this if a third party handles your invoicing and collections.
            </div>
          </div>
        </label>

        {usesFactoring && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1.5px dashed #ddd" }}>
            <SketchInput
              label="Factoring Company Name"
              value={factoringName}
              onChange={setFactoringName}
              placeholder="e.g. OTR Solutions, RTS Financial..."
              required
            />
          </div>
        )}

        <div style={{ borderTop: "1.5px dashed #ddd", margin: "20px 0" }} />

        <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={wantsQuickPay}
            onChange={(e) => setWantsQuickPay(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 2, accentColor: RED, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>I want Quick Pay</div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
              Opt in to receive faster payment on invoices.
            </div>
          </div>
        </label>

        {wantsQuickPay && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1.5px dashed #ddd" }}>
            <div style={{ background: "#f0faf4", border: "1.5px solid #22a355", borderRadius: 2, padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#22a355", marginBottom: 8 }}>✓ Quick Pay Terms</div>
              <ul style={{ fontSize: 13, color: "#444", lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>
                <li><strong>Fee:</strong> 5% of invoice total</li>
                <li><strong>Payment timing:</strong> Within 5 days <em>or</em> the following Wednesday after invoice is received — whichever is later</li>
                <li><strong>Eligibility:</strong> Carrier must successfully complete <strong>3 loads</strong> with Simon Express before becoming eligible for Quick Pay</li>
              </ul>
            </div>
          </div>
        )}
      </Box>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={handleNext} disabled={!form.legalName || !form.mc || !form.ein}>Save & Continue →</Btn>
      </div>
    </div>
  );
}
