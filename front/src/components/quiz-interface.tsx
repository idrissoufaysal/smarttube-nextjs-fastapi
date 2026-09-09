'use client';

import { useState, useEffect } from 'react';

import {
  BrainCircuit,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCcw,
  Loader2,
  Trophy,
  History,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api-config';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

interface QuizAttempt {
  id: string;
  score: number;
  total: number;
  difficulty: string;
  createdAt: string;
}

interface QuizInterfaceProps {
  transcript: string;
  videoId?: string;
}

/* ── Difficulty config ─────────────────────── */
const DIFF_CONFIG = {
  facile:    { label: 'Facile',    dot: 'bg-emerald-400', ring: 'border-emerald-500/40 bg-emerald-500/8 text-emerald-400' },
  moyen:     { label: 'Moyen',     dot: 'bg-amber-400',   ring: 'border-amber-500/40  bg-amber-500/8  text-amber-400'   },
  difficile: { label: 'Difficile', dot: 'bg-rose-400',    ring: 'border-rose-500/40   bg-rose-500/8   text-rose-400'    },
} as const;

type Difficulty = keyof typeof DIFF_CONFIG;

/* ── Mastery levels ───────────────────────── */
type MasteryLevel = 'gold' | 'silver' | 'bronze';
function getMastery(pct: number): { label: string; level: MasteryLevel } {
  if (pct >= 80) return { label: '🏆 Maître',   level: 'gold'   };
  if (pct >= 50) return { label: '💡 Apprenti', level: 'silver' };
  return             { label: '📖 À revoir',  level: 'bronze' };
}
const MASTERY_CLASS: Record<MasteryLevel, string> = {
  gold:   'border-yellow-500/30 bg-yellow-500/8  text-yellow-400',
  silver: 'border-blue-400/30   bg-blue-400/8    text-blue-300',
  bronze: 'border-red-500/30    bg-red-500/8     text-red-400',
};

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'];

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */
export function QuizInterface({ transcript, videoId }: QuizInterfaceProps) {

  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('moyen');
  const [selectedQuestionsCount, setSelectedQuestionsCount] = useState<5 | 10 | 15>(5);
  const [quizState, setQuizState] = useState<'setup' | 'generating' | 'active' | 'finished'>('setup');
  const [quizId, setQuizId] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (videoId) fetchAttempts(); }, [videoId]);

  const fetchAttempts = async () => {
    if (!videoId) return;
    setLoadingAttempts(true);
    try {
      const res = await fetch(`${API_BASE_URL}/quiz/attempt?videoId=${videoId}`);
      if (res.ok) { const d = await res.json(); setAttempts(d.attempts || []); }
    } catch (e) { console.error(e); }
    finally { setLoadingAttempts(false); }
  };

  const startQuizGeneration = async () => {
    setQuizState('generating');
    setError(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setIsAnswerChecked(false);
    try {
      const res = await fetch(`${API_BASE_URL}/video/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, difficulty: selectedDifficulty, numberOfQuestions: selectedQuestionsCount, videoId }),
      });
      if (!res.ok) throw new Error('Erreur lors de la génération du quiz');
      const data = await res.json();
      if (data.quiz?.questions) {
        setQuestions(data.quiz.questions);
        setQuizId(data.quiz.id || '');
        setQuizState('active');
      } else throw new Error('Format de quiz invalide reçu');
    } catch (err: any) {
      setError(err.message || 'Une erreur inattendue est survenue.');
      setQuizState('setup');
    }
  };

  const checkAnswer = () => {
    if (selectedAnswer === null) return;
    setIsAnswerChecked(true);
    if (selectedAnswer === questions[currentQuestionIndex].correctAnswerIndex) setScore(s => s + 1);
  };

  const nextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(i => i + 1);
      setSelectedAnswer(null);
      setIsAnswerChecked(false);
    } else {
      setQuizState('finished');
      await saveQuizAttempt();
    }
  };

  const saveQuizAttempt = async () => {
    if (!videoId || !quizId) return;
    try {
      const finalScore = selectedAnswer === questions[currentQuestionIndex].correctAnswerIndex ? score + 1 : score;
      await fetch(`${API_BASE_URL}/quiz/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, quizId, score: finalScore, total: questions.length, difficulty: selectedDifficulty }),
      });
      fetchAttempts();
    } catch (e) { console.error(e); }
  };

  const formatDate = (s: string) => {
    try { return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(s)); }
    catch { return s; }
  };

  /* ── 1. SETUP ──────────────────────────────── */
  if (quizState === 'setup') return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin py-4 space-y-5 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-on-surface">Practice Questions</h3>
          <p className="text-[11px] text-on-surface/35 mt-0.5">Configurez votre session de quiz active</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-error/8 border border-error/20 text-xs text-error animate-in slide-in-from-top-2 duration-200">
          {error}
        </div>
      )}

      {/* Config card */}
      <div className="rounded-2xl border border-white/[0.05] bg-surface-container/50 divide-y divide-white/[0.04] overflow-hidden">

        {/* Difficulty */}
        <div className="p-4 space-y-3">
          <p className="text-[9px] uppercase tracking-[0.15em] font-bold text-on-surface/25">Difficulté</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(DIFF_CONFIG) as Difficulty[]).map(d => {
              const cfg = DIFF_CONFIG[d];
              const active = selectedDifficulty === d;
              return (
                <button key={d} onClick={() => setSelectedDifficulty(d)}
                  className={cn(
                    'py-2.5 rounded-xl border text-xs font-semibold capitalize transition-all duration-150 flex items-center justify-center gap-1.5',
                    active ? cfg.ring : 'bg-white/[0.02] border-white/[0.05] text-on-surface/30 hover:bg-white/[0.04] hover:text-on-surface/60'
                  )}>
                  {active && <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />}
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Count */}
        <div className="p-4 space-y-3">
          <p className="text-[9px] uppercase tracking-[0.15em] font-bold text-on-surface/25">Questions</p>
          <div className="grid grid-cols-3 gap-2">
            {([5, 10, 15] as const).map(n => (
              <button key={n} onClick={() => setSelectedQuestionsCount(n)}
                className={cn(
                  'py-2.5 rounded-xl border text-xs font-semibold transition-all duration-150',
                  selectedQuestionsCount === n
                    ? 'border-primary/40 bg-primary/8 text-primary'
                    : 'bg-white/[0.02] border-white/[0.05] text-on-surface/30 hover:bg-white/[0.04] hover:text-on-surface/60'
                )}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="p-4">
          <Button onClick={startQuizGeneration}
            className="w-full h-10 bg-primary text-on-primary font-semibold rounded-xl text-sm gap-2 hover:brightness-105 shadow-md shadow-primary/15 transition-all">
            <BrainCircuit className="w-4 h-4" />
            Lancer le Quiz
          </Button>
        </div>
      </div>

      {/* History */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-3 h-3 text-on-surface/20" />
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface/20">Historique</span>
        </div>

        {loadingAttempts ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-4 h-4 text-on-surface/20 animate-spin" />
          </div>
        ) : attempts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.05] py-8 text-center">
            <p className="text-[11px] text-on-surface/20">Aucune tentative enregistrée.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
            {attempts.map(att => {
              const pct = Math.round((att.score / att.total) * 100);
              const m = getMastery(pct);
              const d = DIFF_CONFIG[att.difficulty as Difficulty] || DIFF_CONFIG.moyen;
              return (
                <div key={att.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-on-surface font-mono">{att.score}/{att.total}</span>
                      <span className="text-[10px] text-on-surface/25">({pct}%)</span>
                      <span className={cn('text-[9px] font-bold border px-1.5 py-0.5 rounded-lg', d.ring)}>{att.difficulty}</span>
                    </div>
                    <p className="text-[10px] text-on-surface/25">{formatDate(att.createdAt)}</p>
                  </div>
                  <Badge variant="outline" className={cn('text-[10px] font-bold border shrink-0', MASTERY_CLASS[m.level])}>
                    {m.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  /* ── 2. GENERATING ─────────────────────────── */
  if (quizState === 'generating') return (
    <div className="flex flex-col items-center justify-center h-full min-h-[360px] gap-6 animate-in fade-in duration-300">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/15 blur-3xl rounded-full scale-[2] animate-pulse" />
        <div className="relative w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <BrainCircuit className="w-7 h-7 text-primary animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-1.5">
        <p className="text-sm font-semibold text-on-surface">Conception du quiz…</p>
        <p className="text-xs text-on-surface/35 max-w-[220px] leading-relaxed">
          L'IA formule {selectedQuestionsCount} questions en niveau &quot;{DIFF_CONFIG[selectedDifficulty].label}&quot;.
        </p>
      </div>
      <Progress value={undefined} className="w-32 h-0.5 bg-white/5 [&>div]:bg-primary [&>div]:animate-pulse" />
    </div>
  );

  /* ── 3. FINISHED ───────────────────────────── */
  if (quizState === 'finished') {
    const finalScore = selectedAnswer === questions[currentQuestionIndex].correctAnswerIndex ? score + 1 : score;
    const pct = Math.round((finalScore / questions.length) * 100);
    const m = getMastery(pct);

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 py-6 animate-in fade-in zoom-in-95 duration-400">
        {/* Score ring */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/12 blur-3xl rounded-full scale-[2.5] animate-pulse" />
          <div className="relative w-28 h-28 rounded-3xl bg-surface-container border border-white/[0.06] shadow-2xl flex flex-col items-center justify-center gap-0.5">
            <span className="text-3xl font-black text-on-surface font-mono tabular-nums">{finalScore}/{questions.length}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface/30">{pct}%</span>
          </div>
        </div>

        {/* Feedback */}
        <div className="text-center space-y-2.5">
          <Progress value={pct} className="w-36 h-1 bg-white/5 [&>div]:bg-primary [&>div]:transition-all [&>div]:duration-1000" />
          <Badge variant="outline" className={cn('font-bold border text-xs px-3 py-1', MASTERY_CLASS[m.level])}>
            {m.label}
          </Badge>
          <p className={cn('text-xs max-w-[220px] leading-relaxed font-medium mx-auto',
            pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400/80'
          )}>
            {pct >= 80
              ? 'Masterclass ! Vous maîtrisez parfaitement les concepts.'
              : pct >= 50
                ? 'Bonne base — quelques points à consolider.'
                : 'Recommencez ou posez des questions à l\'IA.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 w-full max-w-[220px]">
          <Button onClick={startQuizGeneration}
            className="w-full h-10 bg-primary text-on-primary font-semibold rounded-xl text-sm gap-2 hover:brightness-105 shadow-md shadow-primary/15">
            <RefreshCcw className="w-3.5 h-3.5" />
            Nouveau Quiz
          </Button>
          <Button variant="ghost" onClick={() => setQuizState('setup')}
            className="w-full h-9 rounded-xl text-sm text-on-surface/40 hover:text-on-surface/70 border border-white/[0.05] font-medium">
            Réglages
          </Button>
        </div>
      </div>
    );
  }

  /* ── 4. ACTIVE ─────────────────────────────── */
  const q = questions[currentQuestionIndex];
  const progress = (currentQuestionIndex / questions.length) * 100;

  return (
    <div className="flex flex-col h-full py-4 gap-4 animate-in fade-in duration-200">

      {/* Progress header */}
      <div className="shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-on-surface/25">
            {currentQuestionIndex + 1} / {questions.length}
          </span>
          <div className="flex items-center gap-1.5 bg-primary/8 text-primary border border-primary/15 px-2.5 py-1 rounded-full">
            <Trophy className="w-3 h-3" />
            <span className="text-xs font-black font-mono">{score}</span>
          </div>
        </div>
        <Progress value={progress}
          className="h-0.5 bg-white/[0.04] [&>div]:bg-primary [&>div]:transition-all [&>div]:duration-500" />
      </div>

      {/* Question */}
      <div className="shrink-0 rounded-2xl border border-white/[0.05] bg-surface-container/40 p-4">
        <p className="text-sm font-semibold text-on-surface leading-relaxed">{q.question}</p>
      </div>

      {/* Options */}
      <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin pr-0.5">
        {q.options.map((option, idx) => {
          const isSelected = selectedAnswer === idx;
          const isCorrect = idx === q.correctAnswerIndex;
          const isWrong = isAnswerChecked && isSelected && !isCorrect;
          const isRevealCorrect = isAnswerChecked && isCorrect;
          const isDimmed = isAnswerChecked && !isSelected && !isCorrect;

          return (
            <button key={idx}
              onClick={() => !isAnswerChecked && setSelectedAnswer(idx)}
              disabled={isAnswerChecked}
              className={cn(
                'w-full text-left flex items-center gap-3 p-3.5 rounded-xl border text-sm transition-all duration-150',
                !isAnswerChecked && !isSelected && 'bg-white/[0.01] border-white/[0.05] text-on-surface/55 hover:bg-white/[0.04] hover:text-on-surface/80 hover:border-white/10 cursor-pointer',
                !isAnswerChecked && isSelected && 'bg-primary/10 border-primary/35 text-primary cursor-pointer',
                isRevealCorrect && 'bg-emerald-500/8 border-emerald-500/25 text-emerald-400',
                isWrong && 'bg-rose-500/8 border-rose-500/25 text-rose-400',
                isDimmed && 'opacity-25 border-transparent bg-transparent cursor-not-allowed',
              )}>
              {/* Key badge */}
              <span className={cn(
                'w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 transition-all',
                !isAnswerChecked && !isSelected && 'bg-white/[0.04] text-on-surface/25',
                !isAnswerChecked && isSelected && 'bg-primary/20 text-primary',
                isRevealCorrect && 'bg-emerald-500/15 text-emerald-400',
                isWrong && 'bg-rose-500/15 text-rose-400',
                isDimmed && 'bg-white/[0.02] text-on-surface/15',
              )}>
                {OPTION_KEYS[idx]}
              </span>

              <span className="leading-snug flex-1">{option}</span>

              {isRevealCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {isWrong && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Footer controls */}
      <div className="shrink-0 pt-2 border-t border-white/[0.04]">
        {!isAnswerChecked ? (
          <Button onClick={checkAnswer} disabled={selectedAnswer === null}
            className="w-full h-10 bg-primary text-on-primary font-semibold rounded-xl text-sm hover:brightness-105 shadow-md shadow-primary/15 disabled:opacity-25 disabled:cursor-not-allowed transition-all">
            Vérifier la réponse
          </Button>
        ) : (
          <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-200">
            <div className={cn(
              'p-3.5 rounded-xl border text-xs leading-relaxed',
              selectedAnswer === q.correctAnswerIndex
                ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400/90'
                : 'bg-rose-500/5 border-rose-500/15 text-rose-400/90'
            )}>
              <span className="font-bold block mb-1 text-[10px] uppercase tracking-wider">
                {selectedAnswer === q.correctAnswerIndex ? '✓ Correct' : '✗ Erreur'}
              </span>
              {q.explanation}
            </div>
            <Button onClick={nextQuestion} variant="outline"
              className="w-full h-9 rounded-xl text-xs font-semibold border-white/[0.08] bg-white/[0.02] text-on-surface/70 hover:bg-white/[0.05] hover:text-on-surface gap-2">
              {currentQuestionIndex < questions.length - 1 ? 'Question suivante' : 'Voir les résultats'}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
