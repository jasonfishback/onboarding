"use client";

import React from "react";

export const RED = "#CC1B1B";
export const DARK = "#1a1a1a";

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
    style={{ background: "white", ...style }}
    onClick={onClick}
  >
    {children}
  </div>
);

export const SketchInput = ({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  type?: string;
}) => (
  <div style={{ marginBottom: 16 }}>
    <label
      style={{
        display: "block",
        fontFamily: "DM Sans",
        fontSize: 17,
        fontWeight: 700,
        marginBottom: 4,
        color: DARK,
      }}
    >
      {label}
      {required && <span style={{ color: RED }}> *</span>}
    </label>
    {hint && (
      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{hint}</div>
    )}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "9px 12px",
        border: "2px solid " + DARK,
        borderRadius: 2,
        fontFamily: "DM Sans",
        fontSize: 14,
        background: "#fafaf8",
        outline: "none",
      }}
    />
  </div>
);

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
  <div style={{ marginBottom: 16 }}>
    <label
      style={{
        display: "block",
        fontFamily: "DM Sans",
        fontSize: 17,
        fontWeight: 700,
        marginBottom: 4,
        color: DARK,
      }}
    >
      {label}
    </label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      style={{
        width: "100%",
        padding: "9px 12px",
        border: "2px solid " + DARK,
        borderRadius: 2,
        fontFamily: "DM Sans",
        fontSize: 14,
        background: "#fafaf8",
        resize: "vertical",
      }}
    />
  </div>
);

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
  <div style={{ marginBottom: 16 }}>
    <label
      style={{
        display: "block",
        fontFamily: "DM Sans",
        fontSize: 17,
        fontWeight: 700,
        marginBottom: 4,
        color: DARK,
      }}
    >
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "9px 12px",
        border: "2px solid " + DARK,
        borderRadius: 2,
        fontFamily: "DM Sans",
        fontSize: 14,
        background: "#fafaf8",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

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
    fontFamily: "DM Sans",
    fontSize: 18,
    fontWeight: 700,
    padding: "10px 28px",
    border: "2px solid " + DARK,
    borderRadius: 2,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "transform .1s",
    display: "inline-block",
    ...style,
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: RED,
      color: "white",
      boxShadow: "3px 3px 0 " + DARK,
    },
    secondary: {
      background: "white",
      color: DARK,
      boxShadow: "3px 3px 0 " + DARK,
    },
    ghost: {
      background: "transparent",
      color: "#666",
      border: "1.5px dashed #aaa",
      boxShadow: "none",
    },
  };
  return (
    <button
      type={type}
      style={{ ...base, ...variants[variant], opacity: disabled ? 0.5 : 1 }}
      onClick={disabled ? undefined : onClick}
      onMouseDown={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.transform =
            "translate(2px,2px)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "";
      }}
    >
      {children}
    </button>
  );
};
