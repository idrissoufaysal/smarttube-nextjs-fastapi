"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

const ORDER = ["system", "light", "dark"] as const;
type ThemeOption = (typeof ORDER)[number];

export function ThemeToggle({ className = "" }: { className?: string }) {
  const t = useTranslations("common.theme");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe mount flag
    setMounted(true);
  }, []);

  const current: ThemeOption = mounted
    ? ((theme as ThemeOption) ?? "system")
    : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const label = t(current);

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={`flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/5 border border-foreground/10 text-foreground/60 hover:bg-foreground/10 hover:text-foreground transition-colors cursor-pointer ${className}`}
      aria-label={label}
      title={label}
    >
      {mounted ? (
        current === "dark" ? (
          <Moon className="w-4 h-4" />
        ) : current === "light" ? (
          <Sun className="w-4 h-4" />
        ) : (
          <Monitor className="w-4 h-4" />
        )
      ) : (
        <Monitor className="w-4 h-4 opacity-0" />
      )}
    </button>
  );
}
