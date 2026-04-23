"use client";

import { useState, useEffect, useRef } from "react";
import { DARK } from "./ui";

interface AddressAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (parts: { street: string; city: string; state: string; zip: string }) => void;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
}

interface Prediction {
  placeId: string;
  description: string;
}

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, required, error }: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showList, setShowList] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressNextFetch = useRef(false);

  // Debounced suggestion lookup
  useEffect(() => {
    if (suppressNextFetch.current) {
      suppressNextFetch.current = false;
      return;
    }
    if (!value || value.length < 3) {
      setPredictions([]);
      setShowList(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/places?mode=suggest&q=${encodeURIComponent(value)}`);
        if (res.ok) {
          const data = await res.json();
          setPredictions(data.predictions || []);
          setShowList((data.predictions || []).length > 0);
          setHighlightIdx(-1);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Click outside to close
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowList(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleSelect = async (p: Prediction) => {
    setShowList(false);
    // Show description in input, then fetch details and fill all fields
    suppressNextFetch.current = true;
    onChange(p.description);
    try {
      const res = await fetch(`/api/places?mode=details&placeId=${encodeURIComponent(p.placeId)}`);
      if (res.ok) {
        const data = await res.json();
        onSelect({
          street: data.street || "",
          city: data.city || "",
          state: data.state || "",
          zip: data.zip || "",
        });
      }
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      handleSelect(predictions[highlightIdx]);
    } else if (e.key === "Escape") {
      setShowList(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>
        Street Address {required && <span style={{ color: "#CC1B1B" }}>*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => predictions.length > 0 && setShowList(true)}
        placeholder={placeholder || "Start typing address..."}
        autoComplete="off"
        style={{
          width: "100%",
          padding: "10px 12px",
          fontFamily: "DM Sans",
          fontSize: 14,
          background: error ? "#fff5f5" : "white",
          border: `2px solid ${error ? "#CC1B1B" : DARK}`,
          borderRadius: 2,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      {loading && (
        <div style={{ position: "absolute", right: 12, top: 34, fontSize: 11, color: "#888" }}>…</div>
      )}
      {showList && predictions.length > 0 && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "white",
          border: "2px solid " + DARK,
          borderTop: "none",
          maxHeight: 240,
          overflowY: "auto",
          zIndex: 50,
          boxShadow: "2px 4px 0 rgba(0,0,0,.08)",
        }}>
          {predictions.map((p, i) => (
            <div
              key={p.placeId}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(p); }}
              onMouseEnter={() => setHighlightIdx(i)}
              style={{
                padding: "10px 12px",
                fontSize: 13,
                fontFamily: "DM Sans",
                cursor: "pointer",
                background: highlightIdx === i ? "#f5f3ef" : "white",
                borderBottom: i < predictions.length - 1 ? "1px solid #eee" : "none",
              }}
            >
              📍 {p.description}
            </div>
          ))}
          <div style={{ padding: "6px 12px", fontSize: 10, color: "#888", fontStyle: "italic", borderTop: "1px solid #eee", textAlign: "right" }}>
            powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
