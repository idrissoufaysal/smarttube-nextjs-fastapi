import { prisma } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import Image from 'next/image';
import { DeleteVideoButton } from '@/components/library/delete-video-button';
import { AddVideoButton } from '@/components/library/add-video-button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Play, Clock, BookOpen, Database, Library } from 'lucide-react';

/* ─────────────────────────────────────────────
   Data fetching
   ───────────────────────────────────────────── */
async function getLibraryVideos() {
  try {
    // Récupérer le clerkId depuis la session
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return null; // Pas connecté (ne devrait pas arriver car route protégée)
    }

    // Trouver l'utilisateur en base
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return []; // Utilisateur pas encore en base (pas de vidéos)
    }

    return await prisma.video.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        author: true,
        thumbnail: true,
        duration: true,
        createdAt: true,
        _count: { select: { segments: true } },
        attempts: { select: { score: true, total: true } },
      },
    });
  } catch (error) {
    console.error('PRISMA ERROR IN LIBRARY:', error);
    return null;
  }
}

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */
type VideoCard = {
  id: string;
  title: string;
  author: string | null;
  thumbnail: string | null;
  duration: number;
  createdAt: Date;
  _count: { segments: number };
  attempts: { score: number; total: number }[];
};

/* ─────────────────────────────────────────────
   Mastery helper
   ───────────────────────────────────────────── */
function getMastery(attempts: { score: number; total: number }[]) {
  if (!attempts.length) return null;
  let maxPct = 0;
  let best = attempts[0];
  attempts.forEach(a => {
    const p = (a.score / a.total) * 100;
    if (p > maxPct) { maxPct = p; best = a; }
  });
  return {
    pct: Math.round(maxPct),
    best,
    count: attempts.length,
    isMastered: maxPct >= 80,
  };
}

/* ─────────────────────────────────────────────
   Video Card Component
   ───────────────────────────────────────────── */
function VideoCardComponent({ video }: { video: VideoCard }) {
  const studyUrl = `https://www.youtube.com/watch?v=${video.id}`;
  const mastery = getMastery(video.attempts);

  return (
    /* Wrapper: relative so delete button can be positioned inside */
    <div className="group relative">
      {/* ── Delete button (appears on hover, positioned top-right of card) ── */}
      <DeleteVideoButton videoId={video.id} videoTitle={video.title} />

      {/* ── Card link ── */}
      <Link
        href={`/study?url=${encodeURIComponent(studyUrl)}`}
        className="block rounded-2xl bg-surface-dim/80 border border-white/[0.04] overflow-hidden transition-all duration-300 hover:border-white/[0.08] hover:bg-surface-low/80 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/40"
      >
        {/* Hover glow */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: 'radial-gradient(circle at 50% 0%, rgba(255,180,168,0.05), transparent 65%)' }}
        />

        {/* ── Thumbnail ── */}
        <div className="relative aspect-video bg-surface-high overflow-hidden">
          {video.thumbnail ? (
            <Image
              src={video.thumbnail}
              alt={video.title}
              loading='eager'
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-surface-high to-surface-dim flex items-center justify-center">
              <Play className="w-8 h-8 text-on-surface/15" />
            </div>
          )}

          {/* Duration pill */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/65 backdrop-blur-md text-white/85 text-[10px] font-bold font-mono px-2 py-0.5 rounded-md tracking-wide">
            <Clock className="w-3 h-3" />
            {formatDuration(video.duration)}
          </div>

          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-all duration-300">
            <div className="w-11 h-11 rounded-full bg-white/0 group-hover:bg-white/15 flex items-center justify-center transition-all duration-300 scale-75 group-hover:scale-100 opacity-0 group-hover:opacity-100 backdrop-blur-sm border border-white/20">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
          </div>
        </div>

        {/* ── Info ── */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <div>
            <h3 className="text-sm font-semibold text-on-surface leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200">
              {video.title}
            </h3>
            {video.author && (
              <p className="text-[11px] text-on-surface/35 mt-1 truncate">{video.author}</p>
            )}
          </div>

          {/* Mastery badge */}
          {mastery ? (
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border tracking-wider ${
                mastery.isMastered
                  ? 'bg-emerald-500/8 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/8 text-amber-400 border-amber-500/20'
              }`}>
                {mastery.isMastered ? '🏆 MAÎTRISÉ' : '💡 APPRIS'}
              </span>
              <span className="text-[10px] text-on-surface/30 font-mono">
                {mastery.best.score}/{mastery.best.total} · {mastery.count} quiz
              </span>
            </div>
          ) : (
            <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-lg border border-white/[0.05] bg-white/[0.02] text-on-surface/20 tracking-wider">
              📖 NON TENTÉ
            </span>
          )}

          {/* Footer meta */}
          <div className="flex items-center justify-between text-[10px] text-on-surface/25 font-medium pt-1 border-t border-white/[0.03]">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {video._count.segments} segments
            </span>
            <span>{formatDate(video.createdAt)}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Stat pill
   ───────────────────────────────────────────── */
function StatPill({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center px-5 py-3 rounded-2xl bg-surface-dim/80 border border-white/[0.04] min-w-[72px]">
      <span className="text-xl font-black gradient-primary-text tabular-nums">{value}</span>
      <span className="text-[9px] text-on-surface/25 uppercase tracking-[0.12em] mt-0.5 font-bold">{label}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Page
   ───────────────────────────────────────────── */
export default async function LibraryPage() {
  const videos = await getLibraryVideos();

  const totalSegments = videos?.reduce((a, v) => a + v._count.segments, 0) ?? 0;
  const totalQuiz = videos?.reduce((a, v) => a + v.attempts.length, 0) ?? 0;

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ── */}
      <div className="relative overflow-hidden border-b border-white/[0.04]">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-10%,_rgba(255,180,168,0.055),_transparent_70%)]" />

        <div className="mx-auto max-w-6xl px-5 md:px-8 pt-14 pb-10 relative">
          {/* Label */}
          <p className="text-label text-primary/70 mb-3 tracking-[0.15em]">Your Collection</p>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-headline text-on-surface flex items-center gap-3">
                <Library className="w-7 h-7 text-primary/60 shrink-0" />
                Ma Bibliothèque
              </h1>
              <p className="mt-2 text-sm text-on-surface/35 max-w-sm leading-relaxed">
                Toutes les vidéos transformées en sessions d'étude actives.
              </p>

              {/* Indicateur de limite d'usage (Shadcn UI Progress & Badge) */}
              {videos !== null && (
                <div className="mt-4 max-w-xs space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface/40 font-medium">Usage gratuit</span>
                    <div className="flex items-center gap-2">
                      <span className="text-on-surface/75 font-semibold font-mono">{videos.length} / 4</span>
                      {videos.length >= 4 && (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider scale-90">
                          Maximum
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Progress value={(videos.length / 4) * 100} className="h-1 bg-white/5" />
                </div>
              )}
            </div>

            {/* Stats + Add button */}
            <div className="flex items-center gap-4 shrink-0 flex-wrap">
              {videos && videos.length > 0 && (
                <div className="flex items-center gap-2">
                  <StatPill value={videos.length} label="Vidéos" />
                  <StatPill value={totalSegments.toLocaleString()} label="Segments" />
                  <StatPill value={totalQuiz} label="Quiz" />
                </div>
              )}
              <AddVideoButton variant="header" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-6xl px-5 md:px-8 py-10">

        {/* DB not configured */}
        {videos === null && (
          <div className="flex flex-col items-center justify-center py-28 text-center animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-2xl bg-surface-dim border border-white/[0.05] flex items-center justify-center mb-6">
              <Database className="w-7 h-7 text-primary/60" />
            </div>
            <h2 className="text-lg font-bold text-on-surface mb-2">Base de données non configurée</h2>
            <p className="text-sm text-on-surface/40 max-w-sm mb-8 leading-relaxed">
              Ajoutez votre variable{' '}
              <code className="text-primary bg-white/5 px-1.5 py-0.5 rounded text-xs">DATABASE_URL</code>{' '}
              dans le fichier{' '}
              <code className="text-primary bg-white/5 px-1.5 py-0.5 rounded text-xs">.env</code>{' '}
              pour activer votre bibliothèque personnelle.
            </p>
            <code className="text-xs text-on-surface/25 bg-surface-dim px-5 py-3 rounded-xl border border-white/[0.05] font-mono">
              DATABASE_URL=&quot;postgresql://user:pass@host/smarttube&quot;
            </code>
          </div>
        )}

        {/* Empty state */}
        {videos !== null && videos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 text-center animate-in fade-in duration-500">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-primary/8 blur-3xl rounded-full scale-[2]" />
              <div className="relative w-20 h-20 rounded-3xl bg-surface-dim border border-white/[0.05] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="h-10 w-10 text-on-surface/15">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
            </div>
            <h2 className="text-lg font-bold text-on-surface mb-2">Votre bibliothèque est vide</h2>
            <p className="text-sm text-on-surface/35 max-w-sm mb-8 leading-relaxed">
              Vous n&apos;avez pas encore étudié de vidéo. Collez un lien YouTube pour démarrer.
            </p>
            <AddVideoButton variant="empty-state" />
          </div>
        )}

        {/* Video grid */}
        {videos !== null && videos.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {videos.map((video, i) => (
              <div
                key={video.id}
                className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <VideoCardComponent video={video} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
