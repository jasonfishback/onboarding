"use client";

import { useState } from "react";
import { Btn, RED, DARK } from "@/components/ui";
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

// Simple field component using CSS classes
function Field({ label, value, onChange, placeholder, required, type = "text", inputMode }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; type?: string; inputMode?: "numeric" | "tel" | "email" | "text";
}) {
  return (
    <div>
      <label className="field-label">
        {label}{required && <span style={{ color: RED }}> *</span>}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="field-input"
      />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="field-input">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ContactSection({ title, data, setData, primaryContact, showCopy }: {
  title: string;
  data: ContactData;
  setData: React.Dispatch<React.SetStateAction<ContactData>>;
  primaryContact: { contactName: string; contactTitle: string; phone: string; email: string };
  showCopy?: boolean;
}) {
  return (
    <div className="step-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 8, borderBottom: "1.5px dashed #ddd" }}>
        <div className="section-title" style={{ margin: 0, padding: 0, border: 0 }}>{title}</div>
        {showCopy && (
          <button
            onClick={() => setData({ name: primaryContact.contactName, title: primaryContact.contactTitle, phone: primaryContact.phone, email: primaryContact.email })}
            style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 700, color: RED, background: "#fff5f5", border: "1.5px solid " + RED, borderRadius: 2, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" }}>
            ⬆ Copy from Primary
          </button>
        )}
      </div>
      <div className="field-grid">
        <Field label="Contact Name" value={data.name} onChange={v => setData(d => ({ ...d, name: v }))} required />
        <Field label="Title / Role" value={data.title} onChange={v => setData(d => ({ ...d, title: v }))} placeholder="Owner, Dispatch…" />
        <Field label="Phone" value={data.phone} onChange={v => setData(d => ({ ...d, phone: v }))} required inputMode="tel" />
        <Field label="Email" value={data.email} onChange={v => setData(d => ({ ...d, email: v }))} required />
      </div>
    </div>
  );
}

export default function Step2({ prefill, onNext, onBack }: Step2Props) {
  const [form, setForm] = useState({
    legalName: prefill?.name || "", dba: "",
    address: prefill?.address || "", city: prefill?.city || "",
    state: prefill?.state || "", zip: prefill?.zip || "",
    phone: prefill?.phone || "", email: prefill?.email || "",
    contactName: "", contactTitle: "",
    mc: prefill?.mc || "", dot: prefill?.dot || "",
    ein: "", truckCount: "", trailerCount: "",
    trailerTypes: { reefer: false, van: false, flatbed: false },
  });

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const toggleTrailer = (t: "reefer" | "van" | "flatbed") =>
    setForm(f => ({ ...f, trailerTypes: { ...f.trailerTypes, [t]: !f.trailerTypes[t] } }));

  const [dispatch, setDispatch] = useState<ContactData>({ name: "", title: "", phone: "", email: "" });
  const [billing, setBilling] = useState<ContactData>({ name: "", title: "", phone: "", email: "" });
  const [diffMailing, setDiffMailing] = useState(false);
  const [mailing, setMailing] = useState({ address: "", city: "", state: "", zip: "" });
  const [usesFactoring, setUsesFactoring] = useState(false);
  const [factoringName, setFactoringName] = useState("");
  const [wantsQuickPay, setWantsQuickPay] = useState(false);

  return (
    <div className="step-wrapper">
      <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>
        Step 2 of 5
      </div>
      <h2 style={{ fontFamily: "DM Sans", fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Company Profile</h2>

      {prefill && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#edfaf3", border: "1.5px solid #22a355", borderRadius: 2, padding: "5px 12px", marginBottom: 16, fontSize: 13, color: "#22a355", fontWeight: 600 }}>
          ✓ Pre-filled from FMCSA — please verify and complete
        </div>
      )}

      {/* Company Info */}
      <div className="step-card">
        <div className="section-title">Company Information</div>
        <div className="field-grid">
          <div className="full"><Field label="Legal Company Name" value={form.legalName} onChange={set("legalName")} required /></div>
          <div className="full"><Field label="DBA / Trade Name" value={form.dba} onChange={set("dba")} placeholder="If different from legal name" /></div>
          <Field label="MC Number" value={form.mc} onChange={set("mc")} placeholder="MC123456" required inputMode="numeric" />
          <Field label="DOT Number" value={form.dot} onChange={set("dot")} placeholder="9876543" inputMode="numeric" />
          <div className="full"><Field label="EIN / Tax ID" value={form.ein} onChange={set("ein")} placeholder="XX-XXXXXXX" required inputMode="numeric" /></div>
          <Field label="Number of Trucks" value={form.truckCount} onChange={set("truckCount")} placeholder="e.g. 5" required inputMode="numeric" />
          <Field label="Number of Trailers" value={form.trailerCount} onChange={set("trailerCount")} placeholder="e.g. 8" required inputMode="numeric" />
        </div>

        {/* Trailer Types */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#555", marginBottom: 8 }}>
            Trailer Types <span style={{ color: RED }}>*</span>
            <span style={{ fontSize: 11, fontWeight: 400, color: "#888", marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>Select all that apply</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {([["reefer", "❄️", "Reefer"], ["van", "📦", "Dry Van"], ["flatbed", "🚛", "Flatbed"]] as const).map(([key, icon, name]) => (
              <button key={key} onClick={() => toggleTrailer(key)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "10px 8px",
                  border: "2px solid " + (form.trailerTypes[key] ? RED : "#ccc"),
                  background: form.trailerTypes[key] ? "#fff5f5" : "white",
                  borderRadius: 2, cursor: "pointer", fontFamily: "DM Sans", fontWeight: 600, fontSize: 14,
                  color: form.trailerTypes[key] ? RED : "#555",
                  boxShadow: form.trailerTypes[key] ? "2px 2px 0 " + RED : "none",
                }}>
                <span style={{ fontSize: 18 }}>{icon}</span>{name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="step-card">
        <div className="section-title">Address</div>
        <div className="field-grid">
          <div className="full"><Field label="Street Address" value={form.address} onChange={set("address")} required /></div>
          <Field label="City" value={form.city} onChange={set("city")} required />
          <Field label="State" value={form.state} onChange={set("state")} placeholder="UT" />
          <div className="full"><Field label="ZIP Code" value={form.zip} onChange={set("zip")} required /></div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={diffMailing} onChange={e => setDiffMailing(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: RED }} />
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#444" }}>Different mailing address</span>
        </label>

        {diffMailing && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1.5px dashed #ddd" }}>
            <div className="field-label" style={{ marginBottom: 10 }}>Mailing Address</div>
            <div className="field-grid">
              <div className="full"><Field label="Street Address" value={mailing.address} onChange={v => setMailing(m => ({ ...m, address: v }))} required /></div>
              <Field label="City" value={mailing.city} onChange={v => setMailing(m => ({ ...m, city: v }))} required />
              <Field label="State" value={mailing.state} onChange={v => setMailing(m => ({ ...m, state: v }))} placeholder="UT" />
              <div className="full"><Field label="ZIP Code" value={mailing.zip} onChange={v => setMailing(m => ({ ...m, zip: v }))} required /></div>
            </div>
          </div>
        )}
      </div>

      {/* Primary Contact */}
      <div className="step-card">
        <div className="section-title">Primary Contact</div>
        <div className="field-grid">
          <Field label="Contact Name" value={form.contactName} onChange={set("contactName")} required />
          <Field label="Title / Role" value={form.contactTitle} onChange={set("contactTitle")} placeholder="Owner, Dispatch…" />
          <Field label="Phone" value={form.phone} onChange={set("phone")} required inputMode="tel" />
          <Field label="Email" value={form.email} onChange={set("email")} required />
        </div>
      </div>

      <ContactSection title="Dispatch Contact" data={dispatch} setData={setDispatch} primaryContact={form} showCopy />
      <ContactSection title="Billing Contact" data={billing} setData={setBilling} primaryContact={form} showCopy />

      {/* Factoring & Quick Pay */}
      <div className="step-card">
        <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", marginBottom: 16 }}>
          <input type="checkbox" checked={usesFactoring} onChange={e => setUsesFactoring(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 2, accentColor: RED, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 700 }}>I use a factoring company</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Check if a third party handles your invoicing.</div>
          </div>
        </label>
        {usesFactoring && (
          <div style={{ marginBottom: 16 }}>
            <Field label="Factoring Company Name" value={factoringName} onChange={setFactoringName} placeholder="e.g. OTR Solutions, RTS Financial…" required />
          </div>
        )}

        <div style={{ borderTop: "1.5px dashed #ddd", paddingTop: 16 }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={wantsQuickPay} onChange={e => setWantsQuickPay(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2, accentColor: RED, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 700 }}>I want Quick Pay</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Faster payment — 5% fee, paid within 5 days or following Wednesday.</div>
            </div>
          </label>
          {wantsQuickPay && (
            <div style={{ marginTop: 12, background: "#f0faf4", border: "1.5px solid #22a355", borderRadius: 2, padding: "12px 14px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#22a355", marginBottom: 6 }}>✓ Quick Pay Terms</div>
              <ul style={{ fontSize: 13, color: "#444", lineHeight: 1.8, paddingLeft: 16, margin: 0 }}>
                <li><strong>Fee:</strong> 5% of invoice total</li>
                <li><strong>Payment:</strong> Within 5 days or following Wednesday — whichever is later</li>
                <li><strong>Eligibility:</strong> Must complete 3 loads with Simon Express first</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={() => onNext({ ...form, dispatch, billing, mailing: diffMailing ? mailing : null, usesFactoring, factoringName, wantsQuickPay })}
          disabled={!form.legalName || !form.mc || !form.ein}>
          Save & Continue →
        </Btn>
      </div>
    </div>
  );
}
