'use client';

import { useAuth, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleSwitcher } from '@/components/locale-switcher';

const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export function Header() {
  const t = useTranslations('header');
  const { isLoaded, isSignedIn } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 glass-subtle bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 md:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 mt-5">
            <Image src="/logo.png" alt="Logo" width={200} height={250} className='w-auto h-auto' />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-foreground/60 md:flex">
            <Link href="/" className="transition-colors duration-200 hover:text-foreground">{t('home')}</Link>
            <Link href="/library" className="transition-colors duration-200 hover:text-foreground">{t('library')}</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-xs min-h-8">
          <LocaleSwitcher />
          <ThemeToggle />
          {isLoaded ? (
            isSignedIn ? (
              <UserButton />
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="hidden text-foreground/60 transition-colors hover:text-foreground md:inline cursor-pointer">
                    {t('signIn')}
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="rounded-sm px-4 py-2 text-xs font-bold gradient-primary text-[#2b140f] transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98] cursor-pointer">
                    {t('start')}
                  </button>
                </SignUpButton>
              </>
            )
          ) : (
            <div className="w-8 h-8 rounded-full border border-foreground/15 animate-pulse bg-foreground/5" />
          )}

          {/* Bouton de menu mobile */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/5 border border-foreground/10 text-foreground/60 hover:bg-foreground/10 hover:text-foreground md:hidden cursor-pointer"
            aria-label={t('toggleMenu')}
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Menu de navigation mobile */}
      {isMobileMenuOpen && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 bg-background/95 backdrop-blur-xl flex flex-col p-6 space-y-6 md:hidden animate-fade-in">
          <nav className="flex flex-col gap-6 text-sm font-semibold text-foreground/60">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="transition-colors hover:text-primary py-2 border-b border-foreground/[0.06]"
            >
              {t('home')}
            </Link>
            <Link
              href="/library"
              onClick={() => setIsMobileMenuOpen(false)}
              className="transition-colors hover:text-primary py-2 border-b border-foreground/[0.06]"
            >
              {t('library')}
            </Link>
            <a
              href="#"
              onClick={() => setIsMobileMenuOpen(false)}
              className="transition-colors hover:text-primary py-2 border-b border-foreground/[0.06]"
            >
              {t('explore')}
            </a>
            {!isSignedIn && isLoaded && (
              <SignInButton mode="modal">
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-left text-foreground/60 transition-colors hover:text-primary py-2 cursor-pointer"
                >
                  {t('signIn')}
                </button>
              </SignInButton>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
