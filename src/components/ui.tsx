"use client";

import React from "react";

/* Brand tokens — kept as named exports because Step components import RED/DARK */
export const RED  = "#D71920";
export const DARK = "#0B0B0C";

/* ============== Box ==============
   Same API as before. New visual language:
   white→paper gradient, rounded, layered shadow + top inset highlight.
   Keeps `sketch-border` className for any existing references.
*/
export const Box = ({
  children,
  style,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}) => (
  <div
    className={`sketch-border ${className}`}
    style={style}
    onClick={onClick}
  >
    {children}
  </div>
);

/* ============== Field label (shared) ============== */
const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 11,
  fontWeight: 600,
  color: "#4B5563",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const baseInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  border: "1px solid #D1D5DB",
  borderRadius: 10,
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 14,
  color: DARK,
  background: "#FFFFFF",
  outline: "none",
  transition: "border-color .15s ease, box-shadow .15s ease",
};

/* small focus + hover handlers shared by inputs */
const onInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = RED;
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(215,25,32,.12)";
};
const onInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = "#D1D5DB";
  e.currentTarget.style.boxShadow = "none";
};

/* ============== SketchInput (renamed visually but same API) ============== */
export const SketchInput = ({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  inputMode?: "numeric" | "tel" | "text" | "email";
}) => (
  <div style={{ marginBottom: 14 }}>
    <label style={labelStyle}>
      {label}
      {required && <span style={{ color: RED }}> *</span>}
    </label>
    {hint && (
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>{hint}</div>
    )}
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={baseInputStyle}
      onFocus={onInputFocus}
      onBlur={onInputBlur}
    />
  </div>
);

/* ============== SketchTextarea ============== */
export const SketchTextarea = ({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) => (
  <div style={{ marginBottom: 14 }}>
    <label style={labelStyle}>{label}</label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      style={{ ...baseInputStyle, resize: "vertical" }}
      onFocus={onInputFocus}
      onBlur={onInputBlur}
    />
  </div>
);

/* ============== SketchSelect ============== */
export const SketchSelect = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <div style={{ marginBottom: 14 }}>
    <label style={labelStyle}>{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...baseInputStyle, cursor: "pointer" }}
      onFocus={onInputFocus}
      onBlur={onInputBlur}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

/* ============== Btn ==============
   Pill-shaped gradient buttons with red glow on primary.
   Same API: variant 'primary' | 'secondary' | 'ghost'.
*/
export const Btn = ({
  children,
  onClick,
  variant = "primary",
  disabled,
  style,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  style?: React.CSSProperties;
  type?: "button" | "submit";
}) => {
  const base: React.CSSProperties = {
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: ".01em",
    padding: "12px 24px",
    borderRadius: 999,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "transform .15s ease, box-shadow .2s ease, opacity .2s ease",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "none",
    ...style,
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: "linear-gradient(180deg, #E1232A 0%, #B8141A 100%)",
      color: "#FFFFFF",
      boxShadow:
        "0 8px 24px rgba(215,25,32,.30), 0 2px 6px rgba(215,25,32,.20), inset 0 1px 0 rgba(255,255,255,.18)",
    },
    secondary: {
      background: "linear-gradient(180deg, #FFFFFF 0%, #F3F4F6 100%)",
      color: DARK,
      border: "1px solid #D1D5DB",
      boxShadow:
        "0 4px 12px rgba(11,11,12,.07), 0 2px 4px rgba(11,11,12,.05), inset 0 1px 0 rgba(255,255,255,.65)",
    },
    ghost: {
      background: "transparent",
      color: "#6B7280",
      border: "1px dashed #9CA3AF",
      boxShadow: "none",
    },
  };

  return (
    <button
      type={type}
      style={{ ...base, ...variants[variant], opacity: disabled ? 0.55 : 1 }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={(e) => {
        if (disabled) return;
        const el = e.currentTarget as HTMLButtonElement;
        if (variant === "primary") {
          el.style.boxShadow =
            "0 12px 32px rgba(215,25,32,.42), 0 4px 10px rgba(215,25,32,.28), inset 0 1px 0 rgba(255,255,255,.22)";
        } else if (variant === "secondary") {
          el.style.boxShadow =
            "0 8px 20px rgba(11,11,12,.10), 0 3px 6px rgba(11,11,12,.06), inset 0 1px 0 rgba(255,255,255,.65)";
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.boxShadow = (variants[variant].boxShadow as string) || "none";
        el.style.transform = "";
      }}
      onMouseDown={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "";
      }}
    >
      {children}
    </button>
  );
};
