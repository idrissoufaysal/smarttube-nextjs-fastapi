"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Sélecteur de langue FR │ EN.
 *
 * `usePathname()` (next-intl) renvoie le chemin sans le préfixe de locale ;
 * on y ré-attache la query string courante pour ne pas perdre d'état
 * (ex. /study?url=...) lors du changement de langue.
 */
export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const t = useTranslations("common.localeSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = (next: string) => {
    if (next === locale) return;

    // Lecture côté client uniquement (au clic) : aucun useSearchParams pendant
    // le rendu serveur, donc aucun impact sur le rendu statique des pages.
    const query = Object.fromEntries(
      new URLSearchParams(window.location.search).entries()
    );

    router.replace(
      Object.keys(query).length > 0 ? { pathname, query } : pathname,
      { locale: next }
    );
  };

  return (
    <div
      className={cn(
        "flex h-8 items-center gap-0.5 rounded-lg bg-foreground/5 border border-foreground/10 p-0.5",
        className
      )}
      role="group"
      aria-label={t("label")}
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => switchLocale(loc)}
          aria-pressed={loc === locale}
          title={t(loc)}
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer",
            loc === locale
              ? "bg-foreground/10 text-foreground"
              : "text-foreground/40 hover:text-foreground/80"
          )}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
