"use client";

import { useState } from "react";
import { Btn, RED, DARK } from "@/components/ui";
import AddressAutocomplete from "@/components/AddressAutocomplete";
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

// Format phone as XXX-XXX-XXXX
function formatPhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return digits.slice(0, 3) + "-" + digits.slice(3);
  return digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6);
}

// Validate email format
function emailError(val: string): string {
  if (!val) return "";
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  return valid ? "" : "Enter a valid email address (e.g. name@domain.com)";
}

// Format ZIP — numeric only, max 5 digits
function formatZip(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(0, 5);
}

// Format EIN as XX-XXXXXXX
function formatEIN(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "").slice(0, 9);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + "-" + digits.slice(2);
}

// Validate EIN — must be exactly 9 digits
function einError(val: string): string {
  const digits = val.replace(/[^0-9]/g, "");
  if (!val) return "";
  if (digits.length < 9) return "EIN must be 9 digits (XX-XXXXXXX)";
  if (digits.length > 9) return "EIN must be exactly 9 digits";
  return "";
}

// Validate phone — must be exactly 10 digits
function phoneError(val: string): string {
  const digits = val.replace(/[^0-9]/g, "");
  if (!val) return "";
  if (digits.length < 10) return "Phone must be 10 digits (XXX-XXX-XXXX)";
  if (digits.length > 10) return "Phone must be exactly 10 digits";
  return "";
}

// Simple field component using CSS classes
function Field({ label, value, onChange, placeholder, required, type = "text", inputMode, error, errorMsg }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; type?: string;
  inputMode?: "numeric" | "tel" | "email" | "text"; error?: boolean; errorMsg?: string;
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
        style={error || errorMsg ? { borderColor: "#CC1B1B", background: "#fff5f5" } : undefined}
      />
      {errorMsg && (
        <div style={{ color: "#CC1B1B", fontSize: 11, fontWeight: 600, marginTop: 3 }}>
          ⚠ {errorMsg}
        </div>
      )}
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
        <Field label="Phone" value={data.phone} onChange={v => setData(d => ({ ...d, phone: formatPhone(v) }))} required inputMode="tel" errorMsg={data.phone ? phoneError(data.phone) : undefined} />
        <Field label="Email" value={data.email} onChange={v => setData(d => ({ ...d, email: v }))} required errorMsg={data.email ? emailError(data.email) : undefined} />
      </div>
    </div>
  );
}

export default function Step2({ prefill, onNext, onBack }: Step2Props) {
  const [form, setForm] = useState({
    legalName: prefill?.name || "", dba: "",
    address: prefill?.address || "", city: prefill?.city || "",
    state: prefill?.state || "", zip: prefill?.zip ? formatZip(prefill.zip) : "",
    phone: prefill?.phone ? formatPhone(prefill.phone) : "", email: prefill?.email || "",
    contactName: prefill?.officerName || "", contactTitle: "",
    mc: prefill?.mc || "", dot: prefill?.dot || "",
    ein: "",
    truckCount: prefill?.truckCount || "",
    trailerCount: "",
    trailerTypes: { reefer: false, van: false, flatbed: false },
  });

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const toggleTrailer = (t: "reefer" | "van" | "flatbed") =>
    setForm(f => ({ ...f, trailerTypes: { ...f.trailerTypes, [t]: !f.trailerTypes[t] } }));

  const [submitted, setSubmitted] = useState(false);  // only show errors after first attempt

  const [dispatch, setDispatch] = useState<ContactData>({ name: "", title: "", phone: "", email: "" });
  const [billing, setBilling] = useState<ContactData>({ name: "", title: "", phone: "", email: "" });
  // Auto-detect different mailing address from FMCSA data
  const hasMailing = !!(prefill?.mailingAddress &&
    prefill.mailingAddress.toUpperCase() !== (prefill?.address || "").toUpperCase());
  const [diffMailing, setDiffMailing] = useState(hasMailing);
  const [mailing, setMailing] = useState({
    address: hasMailing ? (prefill?.mailingAddress || "") : "",
    city: hasMailing ? (prefill?.mailingCity || "") : "",
    state: hasMailing ? (prefill?.mailingState || "") : "",
    zip: hasMailing ? formatZip(prefill?.mailingZip || "") : "",
  });
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

      {/* FMCSA Safety Snapshot — only shown when we have data */}
      {prefill && (prefill.safetyRating || prefill.outOfService === "Yes" || prefill.operationClass || prefill.status || prefill.bipdInsuranceOnFile) && (
        <div style={{ background: "#f8f8f8", border: "1.5px solid " + DARK, borderRadius: 2, padding: "10px 14px", marginBottom: 18, fontSize: 12, fontFamily: "DM Sans" }}>
          <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: ".08em", color: "#555", marginBottom: 6 }}>FMCSA SNAPSHOT</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "6px 16px" }}>
            {prefill.outOfService === "Yes" && (
              <div style={{ color: "#CC1B1B", fontWeight: 700 }}>⚠ Out of Service</div>
            )}
            {prefill.status && (
              <div>
                <strong>Authority:</strong>{" "}
                <span style={{ color: prefill.status === "Active" ? "#22a355" : "#CC1B1B", fontWeight: 700 }}>
                  {prefill.status}
                </span>
              </div>
            )}
            {prefill.safetyRating ? (
              <div>
                <strong>Safety Rating:</strong>{" "}
                <span style={{
                  color: /conditional|unsatisfactory/i.test(prefill.safetyRating) ? "#CC1B1B" : "#22a355",
                  fontWeight: 700
                }}>
                  {prefill.safetyRating}
                </span>
                {prefill.safetyRatingDate && <span style={{ color: "#888" }}> ({prefill.safetyRatingDate})</span>}
              </div>
            ) : (
              <div><strong>Safety Rating:</strong> <span style={{ color: "#888" }}>Not Rated</span></div>
            )}
            {prefill.operationClass && <div><strong>Operation:</strong> {prefill.operationClass}</div>}
            {prefill.truckCount && <div><strong>Power Units:</strong> {prefill.truckCount}</div>}
            {prefill.driverCount && <div><strong>Drivers:</strong> {prefill.driverCount}</div>}
            {prefill.hazmatFlag === "Yes" && <div style={{ color: "#CC1B1B", fontWeight: 700 }}>⚠ Hazmat Authorized</div>}
            {(() => {
              const onFile = parseInt(String(prefill.bipdInsuranceOnFile || "").replace(/[^0-9]/g, ""), 10) || 0;
              const required = parseInt(String(prefill.bipdRequiredAmount || "").replace(/[^0-9]/g, ""), 10) || 0;
              if (!onFile && !required) return null;
              const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;
              const ok = required > 0 ? onFile >= required : onFile > 0;
              return (
                <div>
                  <strong>Liability Ins:</strong>{" "}
                  <span style={{ color: ok ? "#22a355" : "#CC1B1B", fontWeight: 700 }}>
                    {onFile > 0 ? fmt(onFile) : "Not on file"}
                  </span>
                  {required > 0 && <span style={{ color: "#888" }}> / req {fmt(required)}</span>}
                </div>
              );
            })()}
            {(() => {
              const onFile = parseInt(String(prefill.cargoInsuranceOnFile || "").replace(/[^0-9]/g, ""), 10) || 0;
              const required = String(prefill.cargoInsuranceRequired || "").toUpperCase() === "Y";
              if (!onFile && !required) return null;
              const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;
              return (
                <div>
                  <strong>Cargo Ins:</strong>{" "}
                  <span style={{ color: onFile > 0 ? "#22a355" : required ? "#CC1B1B" : "#888", fontWeight: onFile > 0 || required ? 700 : 400 }}>
                    {onFile > 0 ? fmt(onFile) : required ? "Not on file" : "Not required"}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Company Info */}
      <div className="step-card">
        <div className="section-title">Company Information</div>
        <div className="field-grid">
          <div className="full"><Field label="Legal Company Name" value={form.legalName} onChange={set("legalName")} required error={submitted && !form.legalName} /></div>
          <div className="full"><Field label="DBA / Trade Name" value={form.dba} onChange={set("dba")} placeholder="If different from legal name" /></div>
          <Field label={`MC Number${!form.dot ? " *" : " (if applicable)"}`} value={form.mc} onChange={set("mc")} placeholder="MC123456" inputMode="numeric" error={submitted && !form.mc && !form.dot} />
          <Field label={`DOT Number${!form.mc ? " *" : " (if applicable)"}`} value={form.dot} onChange={set("dot")} placeholder="9876543" inputMode="numeric" error={submitted && !form.mc && !form.dot} />
        </div>
        {submitted && !form.mc && !form.dot && (
          <div style={{ fontSize: 12, color: "#CC1B1B", marginBottom: 10, marginTop: -4 }}>
            ⚠ At least one of MC# or DOT# is required.
          </div>
        )}
        <div className="field-grid">
          <div className="full"><Field label="EIN / Tax ID" value={form.ein} onChange={v => set("ein")(formatEIN(v))} placeholder="XX-XXXXXXX" required inputMode="numeric" error={submitted && !form.ein} errorMsg={submitted && form.ein ? einError(form.ein) : undefined} /></div>
          <Field label="Number of Trucks" value={form.truckCount} onChange={set("truckCount")} placeholder="e.g. 5" required inputMode="numeric" error={submitted && !form.truckCount} />
          <Field label="Number of Trailers" value={form.trailerCount} onChange={set("trailerCount")} placeholder="e.g. 8" required inputMode="numeric" error={submitted && !form.trailerCount} />
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
          <div className="full">
            <AddressAutocomplete
              value={form.address}
              onChange={set("address")}
              onSelect={({ street, city, state, zip }) => {
                setForm(f => ({
                  ...f,
                  address: street || f.address,
                  city: city || f.city,
                  state: state || f.state,
                  zip: zip ? formatZip(zip) : f.zip,
                }));
              }}
              required
              error={submitted && !form.address}
            />
          </div>
          <Field label="City" value={form.city} onChange={set("city")} required error={submitted && !form.city} />
          <Field label="State" value={form.state} onChange={set("state")} placeholder="UT" />
          <div className="full"><Field label="ZIP Code" value={form.zip} onChange={v => set("zip")(formatZip(v))} placeholder="12345" required inputMode="numeric" error={submitted && !form.zip} /></div>
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
              <div className="full">
                <AddressAutocomplete
                  value={mailing.address}
                  onChange={v => setMailing(m => ({ ...m, address: v }))}
                  onSelect={({ street, city, state, zip }) => {
                    setMailing(m => ({
                      ...m,
                      address: street || m.address,
                      city: city || m.city,
                      state: state || m.state,
                      zip: zip ? formatZip(zip) : m.zip,
                    }));
                  }}
                  required
                />
              </div>
              <Field label="City" value={mailing.city} onChange={v => setMailing(m => ({ ...m, city: v }))} required />
              <Field label="State" value={mailing.state} onChange={v => setMailing(m => ({ ...m, state: v }))} placeholder="UT" />
              <div className="full"><Field label="ZIP Code" value={mailing.zip} onChange={v => setMailing(m => ({ ...m, zip: formatZip(v) }))} placeholder="12345" required inputMode="numeric" /></div>
            </div>
          </div>
        )}
      </div>

      {/* Primary Contact */}
      <div className="step-card">
        <div className="section-title">Primary Contact</div>
        <div className="field-grid">
          <Field label="Contact Name" value={form.contactName} onChange={set("contactName")} required error={submitted && !form.contactName} />
          <Field label="Title / Role" value={form.contactTitle} onChange={set("contactTitle")} placeholder="Owner, Dispatch…" />
          <Field label="Phone" value={form.phone} onChange={v => set("phone")(formatPhone(v))} required inputMode="tel" error={submitted && !form.phone} errorMsg={submitted && form.phone ? phoneError(form.phone) : undefined} />
          <Field label="Email" value={form.email} onChange={set("email")} required error={submitted && !form.email} errorMsg={submitted && form.email ? emailError(form.email) : undefined} />
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

      {/* Validation error — only shown after first save attempt */}
      {submitted && (() => {
        const missing = [];
        if (!form.legalName) missing.push("Legal Company Name");
        if (!form.mc && !form.dot) missing.push("MC# or DOT#");
        if (!form.ein) missing.push("EIN / Tax ID");
        else if (einError(form.ein)) missing.push(einError(form.ein));
        if (!form.address) missing.push("Street Address");
        if (!form.city) missing.push("City");
        if (!form.zip) missing.push("ZIP Code");
        if (!form.contactName) missing.push("Contact Name");
        if (!form.phone) missing.push("Phone");
        else if (phoneError(form.phone)) missing.push(phoneError(form.phone));
        if (!form.email) missing.push("Email");
        else if (emailError(form.email)) missing.push(emailError(form.email));
        if (missing.length === 0) return null;
        return (
          <div style={{ color: "#CC1B1B", fontSize: 13, fontWeight: 600, textAlign: "center", marginBottom: 6 }}>
            ⚠ Required to continue: {missing.join(", ")}
          </div>
        );
      })()}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={() => {
          setSubmitted(true);
          const valid = !!form.legalName && (!!form.mc || !!form.dot) && !!form.ein &&
            !einError(form.ein) &&
            !!form.address && !!form.city && !!form.zip &&
            !!form.contactName && !!form.phone && !phoneError(form.phone) && !!form.email && !emailError(form.email);
          if (!valid) return;
          onNext({ ...form, dispatch, billing, mailing: diffMailing ? mailing : null, usesFactoring, factoringName, wantsQuickPay });
        }}>
          Save & Continue →
        </Btn>
      </div>
    </div>
  );
}
