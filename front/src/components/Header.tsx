'use client';

import { useAuth, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export function Header() {
  const { isLoaded, isSignedIn } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 glass-subtle">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 md:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Logo" width={200} height={250} />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-white/50 md:flex">
            <Link href="/" className="transition-colors duration-200 hover:text-white/90">Home</Link>
            <Link href="/library" className="transition-colors duration-200 hover:text-white/90">My Library</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-xs min-h-[32px]">
          {isLoaded ? (
            isSignedIn ? (
              <UserButton />
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="hidden text-white/55 transition-colors hover:text-white/85 md:inline cursor-pointer">
                    Se connecter
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="rounded-sm px-4 py-2 text-xs font-bold gradient-primary text-[#2b140f] transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98] cursor-pointer">
                    Commencer
                  </button>
                </SignUpButton>
              </>
            )
          ) : (
            <div className="w-8 h-8 rounded-full border border-white/15 animate-pulse bg-white/5" />
          )}

          {/* Bouton de menu mobile */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white md:hidden cursor-pointer"
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Menu de navigation mobile */}
      {isMobileMenuOpen && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 bg-background/95 backdrop-blur-xl flex flex-col p-6 space-y-6 md:hidden animate-fade-in">
          <nav className="flex flex-col gap-6 text-sm font-semibold text-white/60">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="transition-colors hover:text-primary py-2 border-b border-white/[0.03]"
            >
              Home
            </Link>
            <Link
              href="/library"
              onClick={() => setIsMobileMenuOpen(false)}
              className="transition-colors hover:text-primary py-2 border-b border-white/[0.03]"
            >
              My Library
            </Link>
            <a
              href="#"
              onClick={() => setIsMobileMenuOpen(false)}
              className="transition-colors hover:text-primary py-2 border-b border-white/[0.03]"
            >
              Explore
            </a>
            {!isSignedIn && isLoaded && (
              <SignInButton mode="modal">
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-left text-white/60 transition-colors hover:text-primary py-2 cursor-pointer"
                >
                  Se connecter
                </button>
              </SignInButton>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
