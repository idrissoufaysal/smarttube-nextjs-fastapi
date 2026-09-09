'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Zap, X, Link, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-config';

interface AddVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddVideoModal({ isOpen, onClose }: AddVideoModalProps) {
  const router = useRouter();
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]+/;
    if (!youtubeRegex.test(inputUrl)) {
      setError("Veuillez entrer une URL YouTube valide.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Impossible d'extraire la transcription.");
        return;
      }

      sessionStorage.setItem('smarttube_transcript', data.transcript);
      sessionStorage.setItem('smarttube_segments', JSON.stringify(data.segments));
      sessionStorage.setItem('smarttube_url', inputUrl);
      
      onClose();
      // Redirect to trigger study page load
      router.push(`/study?url=${encodeURIComponent(inputUrl)}`);
    } catch (err) {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {/* Backdrop Overlay */}
        <DialogPrimitive.Overlay 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        
        {/* Centering Wrapper (Flexbox + Scrollable) */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto pointer-events-none">
          {/* Modal content container */}
          <DialogPrimitive.Content
            className="pointer-events-auto glass-modal w-full max-w-2xl rounded-3xl p-6 sm:p-10 border border-outline-variant/20 shadow-2xl outline-none relative overflow-hidden my-8 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            {/* Decorative Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>

            {/* Close Button */}
            <DialogPrimitive.Close asChild>
              <button 
                onClick={onClose}
                type="button"
                className="absolute top-4 right-4 sm:top-6 sm:right-6 text-zinc-500 hover:text-on-surface transition-colors cursor-pointer focus:outline-none p-1.5 rounded-lg hover:bg-white/5"
                aria-label="Close"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </DialogPrimitive.Close>

            <div className="relative z-10">
              <div className="mb-6 sm:mb-8 flex flex-col gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-container flex items-center justify-center rounded-2xl mb-1 sm:mb-2 shadow-lg shadow-primary-container/20">
                  <Zap className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-on-primary-container fill-on-primary-container" />
                </div>
                <h2 className="text-2xl sm:text-4xl font-black tracking-tighter text-on-surface">
                  Débloquez votre session d'étude
                </h2>
                <p className="text-zinc-400 text-sm sm:text-lg leading-relaxed max-w-lg">
                  Collez un lien YouTube pour générer votre transcription, votre résumé et vos questions de pratique.
                </p>
              </div>

              <form onSubmit={handleUrlSubmit} className="space-y-3 sm:space-y-5">
                {/* Input Group */}
                <div className="relative group">
                  <div className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 flex items-center justify-center">
                    <Link className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-zinc-500 group-focus-within:text-primary transition-colors" />
                  </div>
                  <input 
                    className="w-full bg-surface-container border-0 outline-none ring-1 ring-outline-variant/20 focus:ring-primary/40 focus:bg-surface-container transition-all rounded-2xl py-4 sm:py-6 pl-12 sm:pl-14 pr-12 text-on-surface placeholder:text-zinc-600 font-medium text-sm sm:text-base" 
                    placeholder="https://youtube.com/watch?v=..." 
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    disabled={loading}
                  />
                  {loading && (
                    <div className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2">
                      <svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="text-error text-xs sm:text-sm pl-1">{error}</p>
                )}

                {/* Action Button */}
                <button 
                  type="submit"
                  disabled={loading || !inputUrl.trim()}
                  className="group relative w-full overflow-hidden rounded-2xl py-4 sm:py-5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary-container transition-transform duration-300 group-hover:scale-105"></div>
                  <div className="relative flex items-center justify-center gap-3 text-on-primary-container font-black text-xs sm:text-sm tracking-[0.2em]">
                    <span>{loading ? "EXTRACTION..." : "COMMENCER"}</span>
                    {!loading && <ArrowRight className="w-4.5 h-4.5 sm:w-5 sm:h-5" />}
                  </div>
                </button>
              </form>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
