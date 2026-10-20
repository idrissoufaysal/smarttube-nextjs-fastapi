'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { API_BASE_URL } from '@/lib/api-config';
import { readApiError } from '@/lib/api-errors';

interface UrlModalProps {
  onSuccess?: (url: string, transcript: string) => void;
}

export function UrlModal({ onSuccess }: UrlModalProps) {
  const t = useTranslations('modals.urlModal');
  const te = useTranslations('errors');
  const router = useRouter();
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
    if (!youtubeRegex.test(inputUrl)) {
      setError(te("invalidUrl"));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
      });

      if (!res.ok) {
        setError(await readApiError(res, te));
        return;
      }

      const data = await res.json();

      sessionStorage.setItem('smarttube_transcript', data.transcript);
      sessionStorage.setItem('smarttube_segments', JSON.stringify(data.segments));
      sessionStorage.setItem('smarttube_url', inputUrl);
      
      if (onSuccess) {
        onSuccess(inputUrl, data.transcript);
      }
      
      // Update the URL to trigger the study page load
      router.push(`/study?url=${encodeURIComponent(inputUrl)}`);
    } catch {
      setError(te("network"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-surface-container-lowest/80 backdrop-blur-xl">
      <div className="w-full max-w-xl bg-surface-container rounded-2xl p-8 shadow-2xl border border-border animate-fade-up">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">
            {t.rich("title", {
              hl: (chunks) => <span className="text-primary">{chunks}</span>,
            })}
          </h2>
          <p className="text-on-surface-variant text-sm">
            {t("subtitle")}
          </p>
        </div>

        <form onSubmit={handleUrlSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface placeholder:text-foreground/30 focus:outline-none focus:border-primary/50 transition-colors"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
            />
            {loading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
          </div>

          {error && (
            <p className="text-error text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !inputUrl.trim()}
            className="w-full bg-linear-to-br from-primary to-primary-container text-on-primary-container py-3 rounded-xl font-bold text-lg hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loading ? t("extracting") : t("start")}
          </button>
        </form>
      </div>
    </div>
  );
}
