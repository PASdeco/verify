"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanLine, Home, History, Settings } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 z-40 border-t"
      style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
    >
      <div className="max-w-xl mx-auto grid grid-cols-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              style={{
                color: active ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
