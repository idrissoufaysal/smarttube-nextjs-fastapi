'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api-config';

export function UrlInput() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
    if (!youtubeRegex.test(url)) {
      setError("Veuillez entrer une URL YouTube valide.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Impossible d'extraire la transcription.");
        return;
      }

      // sessionStorage évite la limite de longueur d'URL
      sessionStorage.setItem('smarttube_transcript', data.transcript);
      sessionStorage.setItem('smarttube_segments', JSON.stringify(data.segments));
      sessionStorage.setItem('smarttube_url', url);
      router.push(`/study?url=${encodeURIComponent(url)}`);
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mt-8 mx-auto">
      <div className="h-auto md:h-15 bg-surface-container/50 backdrop-blur-lg p-2 rounded-lg border border-outline-variant/10 shadow-2xl flex flex-col md:flex-row gap-2">
        <input
          className="bg-transparent border-none w-full px-6 py-3 md:py-0 text-on-surface focus:ring-0 text-lg placeholder:text-neutral-600"
          placeholder="Collez un lien YouTube..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="bg-linear-to-br from-primary to-primary-container text-on-primary-container w-full md:w-[35%] py-3 md:py-0 rounded-md font-bold text-lg hover:brightness-110 transition-all flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Extraction...
            </span>
          ) : (
            "Commencer"
          )}
        </button>
      </div>
      {error && (
        <p className="text-red-400 text-sm mt-3 text-center">{error}</p>
      )}
    </form>
  );
}
