"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import type { ReactNode } from "react";

/** Segmented theme control: System / Light / Dark. */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="grid grid-cols-3 gap-1 p-1 rounded-xl border"
      style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = (theme ?? "system") === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            style={{
              background: active ? "var(--bg-elevated)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-muted)",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
          >
            <Icon size={16} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeToggle({ children }: { children?: ReactNode }) {
  return null;
}
