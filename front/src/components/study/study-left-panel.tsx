'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { MediaPlayerInstance } from '@vidstack/react';
import {
  Search,
  BookOpen,
  Download,
  Copy,
  Check,
  BrainCircuit,
  RefreshCw,
  FileText,
  Clock,
  Trophy,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SegmentItem, VideoInfo } from './types';
import { ChatInterface } from '@/components/chat-interface';
import { QuizInterface } from '@/components/quiz-interface';

const VideoPlayer = dynamic(() => import('@/components/video-player'), { ssr: false });

export interface StudyLeftPanelProps {
  url: string;
  isMounted: boolean;
  playerRef: React.MutableRefObject<MediaPlayerInstance | null>;
  onTimeUpdate: (time: number) => void;
  videoInfo: VideoInfo | null;
  maxScore: string | null;
  studyTab: 'transcript' | 'notes' | 'ai' | 'quiz';
  setStudyTab: (tab: 'transcript' | 'notes' | 'ai' | 'quiz') => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  showTimestamps: boolean;
  setShowTimestamps: (show: boolean) => void;
  currentTime: number;
  filteredSegments: SegmentItem[];
  handleTimelineClick: (seconds: number) => void;
  handleExportTranscriptPDF: () => void;
  activeSegmentRef: React.RefObject<HTMLDivElement | null>;
  isGenerating: boolean;
  notes: string | null;
  copied: boolean;
  handleCopyNotes: () => void;
  handleExportNotesPDF: () => void;
  handleExportNotes: () => void;
  handleGenerateNotes: (force?: boolean) => void;
  loading?: boolean;
  transcript: string;
  videoId: string | undefined;
}

export function StudyLeftPanel({
  url,
  isMounted,
  playerRef,
  onTimeUpdate,
  videoInfo,
  maxScore,
  studyTab,
  setStudyTab,
  searchTerm,
  setSearchTerm,
  showTimestamps,
  setShowTimestamps,
  currentTime,
  filteredSegments,
  handleTimelineClick,
  handleExportTranscriptPDF,
  activeSegmentRef,
  isGenerating,
  notes,
  copied,
  handleCopyNotes,
  handleExportNotesPDF,
  handleExportNotes,
  handleGenerateNotes,
  loading = false,
  transcript,
  videoId,
}: StudyLeftPanelProps) {

  /* ── Markdown renderer ─────────────────────── */
  const parseMarkdown = (text: string) => {
    const bold = (lineText: string) =>
      lineText.split(/\*\*([^*]+)\*\*/g).map((part, idx) =>
        idx % 2 === 1
          ? <strong key={idx} className="font-bold text-primary">{part}</strong>
          : part
      );

    return text.split('\n').map((line, idx) => {
      const c = line.trim();
      if (!c) return <div key={idx} className="h-3" />;
      if (c.startsWith('# '))  return <h2 key={idx} className="text-xl font-bold text-on-surface mt-6 mb-2 tracking-tight">{bold(c.replace('# ', ''))}</h2>;
      if (c.startsWith('## ')) return <h3 key={idx} className="text-base font-bold text-primary mt-5 mb-1.5">{bold(c.replace('## ', ''))}</h3>;
      if (c.startsWith('### ')) return <h4 key={idx} className="text-sm font-semibold text-on-surface mt-4 mb-1">{bold(c.replace('### ', ''))}</h4>;
      if (c.startsWith('- ') || c.startsWith('* '))
        return <li key={idx} className="ml-4 list-disc text-sm text-on-surface-variant leading-relaxed mb-1">{bold(c.substring(2))}</li>;
      return <p key={idx} className="text-sm text-on-surface-variant leading-relaxed mb-2.5">{bold(c)}</p>;
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  /* ── Render ───────────────────────────────── */
  return (
    <div className="flex-1 overflow-y-auto bg-background h-full scrollbar-thin scrollbar-thumb-surface-highest/40 scrollbar-track-transparent">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* ── VIDEO PLAYER ── */}
        <div className="rounded-2xl overflow-hidden bg-black aspect-video relative shadow-2xl shadow-black/60 ring-1 ring-white/[0.04]">
          {url && isMounted ? (
            <div className="absolute inset-0">
              <VideoPlayer playerRef={playerRef} url={url} onTimeUpdate={onTimeUpdate} />
            </div>
          ) : (
            <Skeleton className="absolute inset-0 rounded-none" />
          )}
        </div>

        {/* ── VIDEO META ── */}
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {loading ? (
            <>
              <Skeleton className="h-8 w-3/4" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-on-surface leading-tight tracking-tight">
                {videoInfo?.title || 'Chargement de la vidéo…'}
              </h1>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-on-surface/35 font-medium">
                  {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <span className="w-1 h-1 rounded-full bg-on-surface/15" />
                <Badge variant="outline" className="text-[10px] border-primary/20 bg-primary/5 text-primary font-bold px-2 py-0.5">
                  AI / ML
                </Badge>
                {maxScore && (
                  <Badge variant="outline" className="text-[10px] border-green-500/25 bg-green-500/8 text-green-400 font-bold gap-1 px-2 py-0.5 animate-in fade-in duration-300">
                    <Trophy className="w-2.5 h-2.5" />
                    Score Max: {maxScore}
                  </Badge>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── TABS CARD ── */}
        <div className="rounded-2xl border border-white/[0.05] bg-surface-dim/80 backdrop-blur-sm overflow-hidden shadow-xl shadow-black/20 animate-in fade-in slide-in-from-bottom-3 duration-600">

          {/* Tab switcher - Desktop */}
          <div className="hidden lg:flex items-center border-b border-white/[0.05] bg-surface-low/50 px-4 pt-3 gap-1">
            <TabButton
              active={studyTab === 'transcript'}
              icon={<FileText className="w-3.5 h-3.5" />}
              label="Transcription"
              onClick={() => setStudyTab('transcript')}
            />
            <TabButton
              active={studyTab === 'notes'}
              icon={<BrainCircuit className="w-3.5 h-3.5" />}
              label="Notes de cours"
              onClick={() => setStudyTab('notes')}
              highlight
            />
          </div>

          {/* Tab switcher - Mobile */}
          <div className="flex lg:hidden items-center border-b border-white/[0.05] bg-surface-low/50 px-4 pt-3 gap-1 overflow-x-auto scrollbar-none">
            <TabButton
              active={studyTab === 'transcript'}
              icon={<FileText className="w-3.5 h-3.5" />}
              label="Transc."
              onClick={() => setStudyTab('transcript')}
            />
            <TabButton
              active={studyTab === 'notes'}
              icon={<BrainCircuit className="w-3.5 h-3.5" />}
              label="Notes"
              onClick={() => setStudyTab('notes')}
              highlight
            />
            <TabButton
              active={studyTab === 'ai'}
              icon={<MessageSquare className="w-3.5 h-3.5" />}
              label="Chat IA"
              onClick={() => setStudyTab('ai')}
            />
            <TabButton
              active={studyTab === 'quiz'}
              icon={<HelpCircle className="w-3.5 h-3.5" />}
              label="Quiz"
              onClick={() => setStudyTab('quiz')}
            />
          </div>

          {/* Tab content */}
          <div className="p-5">
            {studyTab === 'transcript' && (
              <TranscriptTab
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                showTimestamps={showTimestamps}
                setShowTimestamps={setShowTimestamps}
                filteredSegments={filteredSegments}
                currentTime={currentTime}
                activeSegmentRef={activeSegmentRef}
                handleTimelineClick={handleTimelineClick}
                handleExportTranscriptPDF={handleExportTranscriptPDF}
                formatTime={formatTime}
                loading={loading}
              />
            )}
            {studyTab === 'notes' && (
              <NotesTab
                isGenerating={isGenerating}
                notes={notes}
                copied={copied}
                handleCopyNotes={handleCopyNotes}
                handleExportNotesPDF={handleExportNotesPDF}
                handleExportNotes={handleExportNotes}
                handleGenerateNotes={handleGenerateNotes}
                parseMarkdown={parseMarkdown}
              />
            )}
            {studyTab === 'ai' && (
              <div className="h-[450px] overflow-hidden -mx-5 -my-5 p-1 bg-surface-low">
                {transcript ? (
                  <ChatInterface
                    transcript={transcript}
                    url={url}
                    onTimelineClick={handleTimelineClick}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-on-surface-variant space-y-4">
                    <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <p className="text-sm">Chargement de la transcription...</p>
                  </div>
                )}
              </div>
            )}
            {studyTab === 'quiz' && (
              <div className="h-[450px] overflow-y-auto px-1 -my-5 py-5 scrollbar-thin bg-surface-low">
                <QuizInterface transcript={transcript} videoId={videoId} />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Sub-components
   ════════════════════════════════════════════ */

function TabButton({
  active, icon, label, onClick, highlight,
}: {
  active: boolean; icon: React.ReactNode; label: string;
  onClick: () => void; highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-semibold transition-all duration-200 border-b-2 -mb-px relative',
        active
          ? 'text-primary border-primary bg-primary/5'
          : 'text-on-surface/35 border-transparent hover:text-on-surface/60 hover:bg-white/[0.03]',
        highlight && !active && 'text-primary/50'
      )}
    >
      <span className={cn('transition-colors', active ? 'text-primary' : 'text-on-surface/30', highlight && !active && 'text-primary/40')}>
        {icon}
      </span>
      {label}
    </button>
  );
}

/* ── Transcript Tab ── */
function TranscriptTab({
  searchTerm, setSearchTerm, showTimestamps, setShowTimestamps,
  filteredSegments, currentTime, activeSegmentRef, handleTimelineClick,
  handleExportTranscriptPDF, formatTime, loading,
}: {
  searchTerm: string; setSearchTerm: (v: string) => void;
  showTimestamps: boolean; setShowTimestamps: (v: boolean) => void;
  filteredSegments: SegmentItem[]; currentTime: number;
  activeSegmentRef: React.RefObject<HTMLDivElement | null>;
  handleTimelineClick: (s: number) => void;
  handleExportTranscriptPDF: () => void;
  formatTime: (s: number) => string;
  loading?: boolean;
}) {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface/25 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher dans la transcription…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container/50 border border-white/[0.06] rounded-xl pl-9 pr-4 py-2 text-xs text-on-surface placeholder:text-on-surface/25 focus:outline-none focus:border-primary/30 focus:bg-surface-container transition-all"
          />
        </div>

        {/* Timestamp toggle */}
        <button
          onClick={() => setShowTimestamps(!showTimestamps)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border shrink-0',
            showTimestamps
              ? 'bg-primary/10 border-primary/25 text-primary'
              : 'bg-white/[0.03] border-white/[0.06] text-on-surface/40 hover:text-on-surface/70'
          )}
        >
          <Clock className="w-3 h-3" />
          Horodatage
        </button>

        {/* Export */}
        <Button
          size="sm"
          onClick={handleExportTranscriptPDF}
          className="h-8 text-xs font-semibold bg-primary text-on-primary rounded-xl gap-1.5 px-3 hover:brightness-105 shadow-sm shadow-primary/20 shrink-0"
        >
          <Download className="w-3 h-3" />
          PDF
        </Button>
      </div>

      {/* Segments list */}
      <div className="max-h-[380px] overflow-y-auto space-y-0.5 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {loading ? (
          <>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-3 py-2.5">
                <Skeleton className="h-4 w-12 shrink-0 rounded-md" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </>
        ) : filteredSegments.length > 0 ? (
          filteredSegments.map((seg, idx) => {
            const isActive = currentTime >= seg.start && currentTime < seg.start + (seg.duration || 5);
            return (
              <div
                key={idx}
                ref={isActive ? activeSegmentRef : null}
                className={cn(
                  'flex gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer group',
                  isActive
                    ? 'bg-primary/8 ring-1 ring-primary/15'
                    : 'hover:bg-white/[0.025]'
                )}
                onClick={() => handleTimelineClick(seg.start)}
              >
                {showTimestamps && (
                  <span className={cn(
                    'shrink-0 font-mono text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded-md tabular-nums leading-none',
                    isActive
                      ? 'bg-primary text-on-primary'
                      : 'text-primary/60 bg-primary/8 group-hover:bg-primary/15'
                  )}>
                    {formatTime(seg.start)}
                  </span>
                )}
                <p className={cn(
                  'text-xs leading-relaxed flex-1 transition-colors',
                  isActive ? 'text-on-surface font-medium' : 'text-on-surface/55 group-hover:text-on-surface/80'
                )}>
                  {seg.text}
                </p>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center">
            <p className="text-xs text-on-surface/25">Aucun résultat pour cette recherche.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Notes Tab ── */
function NotesTab({
  isGenerating, notes, copied,
  handleCopyNotes, handleExportNotesPDF, handleExportNotes,
  handleGenerateNotes, parseMarkdown,
}: {
  isGenerating: boolean; notes: string | null; copied: boolean;
  handleCopyNotes: () => void; handleExportNotesPDF: () => void;
  handleExportNotes: () => void;
  handleGenerateNotes: (force?: boolean) => void;
  parseMarkdown: (text: string) => React.ReactNode;
}) {
  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6 animate-in fade-in duration-300">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/15 blur-2xl rounded-full scale-150 animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" style={{ animationDuration: '2s' }} />
          </div>
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-sm font-semibold text-on-surface">Génération des notes…</p>
          <p className="text-xs text-on-surface/40 max-w-[260px] leading-relaxed">
            L'IA analyse la transcription et structure votre synthèse.
          </p>
        </div>
        <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '70%' }} />
        </div>
      </div>
    );
  }

  if (notes) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Action bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap pb-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary/70" />
            <span className="text-xs font-semibold text-on-surface/70">Synthèse de la vidéo</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyNotes}
              className={cn(
                'h-7 text-xs gap-1.5 rounded-lg px-2.5 border border-white/[0.06]',
                copied ? 'text-green-400 border-green-500/20 bg-green-500/5' : 'text-on-surface/50 hover:text-on-surface hover:bg-white/[0.04]'
              )}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copié' : 'Copier'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportNotes}
              className="h-7 text-xs gap-1.5 rounded-lg px-2.5 border border-white/[0.06] text-on-surface/50 hover:text-on-surface hover:bg-white/[0.04]"
            >
              Markdown
            </Button>
            <Button
              size="sm"
              onClick={handleExportNotesPDF}
              className="h-7 text-xs font-semibold bg-primary text-on-primary rounded-lg gap-1 px-2.5 hover:brightness-105 shadow-sm shadow-primary/20"
            >
              <Download className="w-3 h-3" />
              PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleGenerateNotes(true)}
              className="h-7 text-xs gap-1.5 rounded-lg px-2.5 border border-white/[0.06] text-on-surface/40 hover:text-on-surface/70"
            >
              <RefreshCw className="w-3 h-3" />
              Régénérer
            </Button>
          </div>
        </div>

        {/* Notes content */}
        <div className="max-h-[450px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <div className="prose-sm space-y-0.5">
            {parseMarkdown(notes)}
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6 animate-in fade-in duration-300">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full scale-[2]" />
        <div className="relative w-16 h-16 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center">
          <BrainCircuit className="w-6 h-6 text-primary/80" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-sm font-semibold text-on-surface">Notes de cours IA</p>
        <p className="text-xs text-on-surface/40 max-w-[280px] leading-relaxed">
          L'IA analyse la transcription et rédige une synthèse structurée, claire et exploitable pour vos révisions.
        </p>
      </div>
      <Button
        onClick={() => handleGenerateNotes(false)}
        className="gap-2 bg-primary text-on-primary font-semibold rounded-xl px-6 h-10 text-sm hover:brightness-105 shadow-lg shadow-primary/15"
      >
        <BrainCircuit className="w-4 h-4" />
        Générer les notes
      </Button>
    </div>
  );
}
