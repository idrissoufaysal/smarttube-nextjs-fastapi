import { Suspense } from 'react';
import { StudyContent } from '@/components/study-content';
import { Skeleton } from '@/components/ui/skeleton';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "SmartTube | Session d'étude",
  description: "Étudiez vos vidéos de manière active avec des synthèses par IA, des transcriptions interactives et des quiz personnalisés.",
};

function StudyPageSkeleton() {
  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-hidden bg-surface-container-lowest flex flex-row">
      {/* Left panel skeleton */}
      <div className="flex-1 overflow-y-auto bg-background h-full">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          {/* Video player skeleton */}
          <Skeleton className="rounded-2xl aspect-video w-full" />

          {/* Title & meta skeleton */}
          <div className="space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
          </div>

          {/* Tabs card skeleton */}
          <div className="rounded-2xl border border-white/[0.05] bg-surface-dim/80 overflow-hidden">
            {/* Tab headers */}
            <div className="flex items-center border-b border-white/[0.05] bg-surface-low/50 px-4 pt-3 gap-1">
              <Skeleton className="h-9 w-28 rounded-t-lg" />
              <Skeleton className="h-9 w-28 rounded-t-lg" />
            </div>
            {/* Content */}
            <div className="p-5 space-y-3">
              <Skeleton className="h-9 w-full rounded-xl" />
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-4 w-12 shrink-0 rounded-md" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel skeleton */}
      <div className="w-[450px] bg-surface-low border-l border-outline-variant/10 flex flex-col shrink-0 h-full">
        <div className="border-b border-outline-variant/10 bg-surface-container-low flex gap-0 shrink-0">
          <Skeleton className="flex-1 h-14 rounded-none" />
          <Skeleton className="flex-1 h-14 rounded-none" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-10 w-3/4 rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-12 w-5/6 rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-10 w-2/3 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={<StudyPageSkeleton />}>
      <StudyContent />
    </Suspense>
  );
}
