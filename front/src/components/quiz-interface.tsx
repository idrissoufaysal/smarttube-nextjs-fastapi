'use client';

import { useState, useEffect } from 'react';
import { useAuth, SignInButton } from '@clerk/nextjs';
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
  Sparkles,
  Clock,
  Target,
  Award,
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
  facile: {
    label: 'Facile',
    desc: 'Bases & repères',
    dot: 'bg-emerald-400',
    activeClass:
      'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 shadow-sm shadow-emerald-500/10',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
  moyen: {
    label: 'Moyen',
    desc: 'Compréhension',
    dot: 'bg-amber-400',
    activeClass:
      'border-amber-500/50 bg-amber-500/10 text-amber-300 shadow-sm shadow-amber-500/10',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  },
  difficile: {
    label: 'Difficile',
    desc: 'Analyse & synthèse',
    dot: 'bg-rose-400',
    activeClass:
      'border-rose-500/50 bg-rose-500/10 text-rose-300 shadow-sm shadow-rose-500/10',
    badgeClass: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  },
} as const;

type Difficulty = keyof typeof DIFF_CONFIG;

/* ── Question Count config ─────────────────── */
const COUNT_OPTIONS = [
  { count: 5 as const, label: 'Express', est: '~2 min' },
  { count: 10 as const, label: 'Standard', est: '~5 min' },
  { count: 15 as const, label: 'Complet', est: '~8 min' },
];

/* ── Mastery levels ───────────────────────── */
type MasteryLevel = 'gold' | 'silver' | 'bronze';
function getMastery(pct: number): { label: string; level: MasteryLevel } {
  if (pct >= 80) return { label: '🏆 Maître', level: 'gold' };
  if (pct >= 50) return { label: '💡 Apprenti', level: 'silver' };
  return { label: '📖 À revoir', level: 'bronze' };
}
const MASTERY_CLASS: Record<MasteryLevel, string> = {
  gold: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  silver: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
  bronze: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'];

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */
export function QuizInterface({ transcript, videoId }: QuizInterfaceProps) {
  const { userId, isSignedIn } = useAuth();
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

  useEffect(() => {
    if (videoId) fetchAttempts();
  }, [videoId, userId]);

  const fetchAttempts = async () => {
    if (!videoId) return;
    setLoadingAttempts(true);
    try {
      const headers: Record<string, string> = {};
      if (userId) headers['x-clerk-user-id'] = userId;

      const res = await fetch(`${API_BASE_URL}/quiz/attempt?videoId=${videoId}`, { headers });
      if (res.ok) {
        const d = await res.json();
        setAttempts(d.attempts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAttempts(false);
    }
  };

  const startQuizGeneration = async () => {
    if (!isSignedIn) {
      setError("Veuillez vous connecter pour générer un quiz avec l'IA.");
      setQuizState('setup');
      return;
    }

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
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-clerk-user-id': userId } : {}),
        },
        body: JSON.stringify({
          transcript,
          difficulty: selectedDifficulty,
          numberOfQuestions: selectedQuestionsCount,
          videoId,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || 'Erreur lors de la génération du quiz');
      }
      const data = await res.json();
      if (data.quiz?.questions) {
        setQuestions(data.quiz.questions);
        setQuizId(data.quiz.id || '');
        setQuizState('active');
      } else {
        throw new Error('Format de quiz invalide reçu');
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur inattendue est survenue.');
      setQuizState('setup');
    }
  };

  const checkAnswer = () => {
    if (selectedAnswer === null) return;
    setIsAnswerChecked(true);
    if (selectedAnswer === questions[currentQuestionIndex].correctAnswerIndex) {
      setScore((s) => s + 1);
    }
  };

  const nextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((i) => i + 1);
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
      const finalScore =
        selectedAnswer === questions[currentQuestionIndex].correctAnswerIndex ? score + 1 : score;
      await fetch(`${API_BASE_URL}/quiz/attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-clerk-user-id': userId } : {}),
        },
        body: JSON.stringify({
          videoId,
          quizId,
          score: finalScore,
          total: questions.length,
          difficulty: selectedDifficulty,
        }),
      });
      fetchAttempts();
    } catch (e) {
      console.error(e);
    }
  };

  const formatDate = (s: string) => {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(s));
    } catch {
      return s;
    }
  };

  /* ── 1. SETUP ──────────────────────────────── */
  if (quizState === 'setup') {
    return (
      <div className="flex flex-col h-full overflow-y-auto px-5 py-5 space-y-6 scrollbar-thin animate-in fade-in duration-300">
        {/* Header Intro */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/25 flex items-center justify-center text-primary shrink-0 shadow-sm shadow-primary/10">
            <Zap className="w-5 h-5 fill-primary/20" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-on-surface tracking-tight">
                Practice Questions
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                IA Active
              </span>
            </div>
            <p className="text-xs text-on-surface-variant/80 leading-relaxed">
              Configurez et lancez une session pour valider votre apprentissage.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/25 text-xs text-error font-medium animate-in slide-in-from-top-2 duration-200">
            {error}
          </div>
        )}

        {/* Main Config Card */}
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container/60 backdrop-blur-sm p-4.5 space-y-5 shadow-sm">
          {/* Difficulté */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-on-surface flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-on-surface-variant" />
                Niveau de difficulté
              </span>
              <span className="text-[11px] text-on-surface-variant/70 font-medium">
                {DIFF_CONFIG[selectedDifficulty].desc}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DIFF_CONFIG) as Difficulty[]).map((d) => {
                const cfg = DIFF_CONFIG[d];
                const active = selectedDifficulty === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDifficulty(d)}
                    className={cn(
                      'py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all duration-200 flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-[0.98]',
                      active
                        ? cfg.activeClass
                        : 'bg-surface-container-low/50 border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high/40 hover:text-on-surface'
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full transition-transform',
                          cfg.dot,
                          active && 'scale-110 shadow-xs'
                        )}
                      />
                      <span>{cfg.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nombre de questions */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-on-surface flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-on-surface-variant" />
                Nombre de questions
              </span>
              <span className="text-[11px] text-on-surface-variant/70 font-medium">
                {COUNT_OPTIONS.find((c) => c.count === selectedQuestionsCount)?.est} estimées
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {COUNT_OPTIONS.map((item) => {
                const active = selectedQuestionsCount === item.count;
                return (
                  <button
                    key={item.count}
                    type="button"
                    onClick={() => setSelectedQuestionsCount(item.count)}
                    className={cn(
                      'py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all duration-200 flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-[0.98]',
                      active
                        ? 'border-primary/50 bg-primary/10 text-primary shadow-sm shadow-primary/10'
                        : 'bg-surface-container-low/50 border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high/40 hover:text-on-surface'
                    )}
                  >
                    <span className="text-sm font-bold">{item.count}</span>
                    <span className="text-[10px] opacity-70 font-normal">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CTA Button */}
          {!isSignedIn ? (
            <div className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl bg-surface-container border border-outline-variant/15 text-center">
              <span className="text-xs text-muted-foreground">Connectez-vous pour lancer un quiz généré par l'IA</span>
              <SignInButton mode="modal">
                <Button type="button" size="sm" className="rounded-full px-5 h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-on-primary">
                  Se connecter pour jouer
                </Button>
              </SignInButton>
            </div>
          ) : (
            <Button
              type="button"
              onClick={startQuizGeneration}
              disabled={!transcript}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-xl text-sm gap-2.5 shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <BrainCircuit className="w-4 h-4" />
              Lancer le Quiz ({selectedQuestionsCount} questions)
            </Button>
          )}
        </div>

        {/* Historique Section */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-on-surface-variant" />
              <span className="text-xs font-bold text-on-surface">Historique des sessions</span>
            </div>
            {attempts.length > 0 && (
              <span className="text-[11px] text-on-surface-variant font-medium">
                {attempts.length} {attempts.length > 1 ? 'tentatives' : 'tentative'}
              </span>
            )}
          </div>

          {loadingAttempts ? (
            <div className="flex items-center justify-center py-8 rounded-xl border border-outline-variant/10 bg-surface-container/30">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : attempts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container/20 p-6 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-surface-container-high/40 border border-outline-variant/15 flex items-center justify-center mx-auto text-on-surface-variant/60">
                <Award className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-on-surface">Aucune tentative enregistrée</p>
              <p className="text-[11px] text-on-surface-variant/70 max-w-[260px] mx-auto leading-relaxed">
                Terminez votre premier quiz pour mesurer votre progression et retrouver vos scores ici.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {attempts.map((att) => {
                const pct = Math.round((att.score / att.total) * 100);
                const m = getMastery(pct);
                const d = DIFF_CONFIG[att.difficulty as Difficulty] || DIFF_CONFIG.moyen;
                return (
                  <div
                    key={att.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border border-outline-variant/15 bg-surface-container/40 hover:bg-surface-container-high/40 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-on-surface font-mono">
                          {att.score}/{att.total}
                        </span>
                        <span className="text-xs text-on-surface-variant font-medium">
                          ({pct}%)
                        </span>
                        <span
                          className={cn(
                            'text-[10px] font-semibold border px-2 py-0.5 rounded-md capitalize',
                            d.badgeClass
                          )}
                        >
                          {att.difficulty}
                        </span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant/70">
                        {formatDate(att.createdAt)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] font-bold border shrink-0', MASTERY_CLASS[m.level])}
                    >
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
  }

  /* ── 2. GENERATING ─────────────────────────── */
  if (quizState === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[380px] px-6 gap-6 animate-in fade-in duration-300">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-surface-container border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/10">
            <BrainCircuit className="w-8 h-8 text-primary animate-pulse" />
          </div>
        </div>

        <div className="text-center space-y-2 max-w-[260px]">
          <h4 className="text-sm font-bold text-on-surface">Création de votre quiz...</h4>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            L&apos;IA analyse les moments clés pour formuler {selectedQuestionsCount} questions en niveau{' '}
            <span className="font-semibold text-primary">{DIFF_CONFIG[selectedDifficulty].label}</span>.
          </p>
        </div>

        <div className="w-40 space-y-1">
          <Progress
            value={undefined}
            className="h-1 bg-surface-container-high [&>div]:bg-primary [&>div]:animate-pulse"
          />
        </div>
      </div>
    );
  }

  /* ── 3. FINISHED ───────────────────────────── */
  if (quizState === 'finished') {
    const finalScore =
      selectedAnswer === questions[currentQuestionIndex]?.correctAnswerIndex ? score + 1 : score;
    const pct = Math.round((finalScore / questions.length) * 100);
    const m = getMastery(pct);

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[420px] px-6 py-6 gap-6 animate-in fade-in zoom-in-95 duration-400">
        {/* Score Ring / Card */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/15 blur-3xl rounded-full scale-150 animate-pulse" />
          <div className="relative w-32 h-32 rounded-3xl bg-surface-container border border-outline-variant/20 shadow-2xl flex flex-col items-center justify-center gap-1">
            <span className="text-3xl font-black text-on-surface font-mono tabular-nums">
              {finalScore}/{questions.length}
            </span>
            <span className="text-xs font-bold tracking-wider text-primary">{pct}%</span>
          </div>
        </div>

        {/* Feedback message */}
        <div className="text-center space-y-3 max-w-[280px]">
          <Badge
            variant="outline"
            className={cn('font-bold border text-xs px-3.5 py-1', MASTERY_CLASS[m.level])}
          >
            {m.label}
          </Badge>

          <p
            className={cn(
              'text-xs leading-relaxed font-medium',
              pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-rose-400'
            )}
          >
            {pct >= 80
              ? 'Excellente maîtrise ! Vous avez retenu l’essentiel du cours.'
              : pct >= 50
              ? 'Bonne assimilation globale. Révisez les points manqués dans les notes.'
              : 'N’hésitez pas à revoir la vidéo ou poser des questions à l’assistant IA.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 w-full max-w-[240px]">
          <Button
            type="button"
            onClick={startQuizGeneration}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-xl text-sm gap-2 shadow-md shadow-primary/20 transition-all cursor-pointer"
          >
            <RefreshCcw className="w-4 h-4" />
            Nouveau Quiz
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setQuizState('setup')}
            className="w-full h-10 rounded-xl text-xs text-on-surface-variant hover:text-on-surface border border-outline-variant/15 font-semibold cursor-pointer"
          >
            Changer les réglages
          </Button>
        </div>
      </div>
    );
  }

  /* ── 4. ACTIVE QUIZ ────────────────────────── */
  const q = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="flex flex-col h-full px-5 py-5 gap-4.5 animate-in fade-in duration-200">
      {/* Progress header */}
      <div className="shrink-0 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-on-surface-variant tracking-wider uppercase text-[10px]">
            Question {currentQuestionIndex + 1} sur {questions.length}
          </span>
          <div className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full font-semibold">
            <Trophy className="w-3.5 h-3.5" />
            <span className="font-mono text-xs">{score} pts</span>
          </div>
        </div>
        <Progress
          value={progress}
          className="h-1.5 bg-surface-container-high rounded-full [&>div]:bg-primary [&>div]:transition-all [&>div]:duration-300"
        />
      </div>

      {/* Question Card */}
      <div className="shrink-0 rounded-2xl border border-outline-variant/15 bg-surface-container/70 p-4.5 shadow-sm">
        <p className="text-sm font-semibold text-on-surface leading-relaxed">{q.question}</p>
      </div>

      {/* Options List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 scrollbar-thin pr-0.5">
        {q.options.map((option, idx) => {
          const isSelected = selectedAnswer === idx;
          const isCorrect = idx === q.correctAnswerIndex;
          const isWrong = isAnswerChecked && isSelected && !isCorrect;
          const isRevealCorrect = isAnswerChecked && isCorrect;
          const isDimmed = isAnswerChecked && !isSelected && !isCorrect;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => !isAnswerChecked && setSelectedAnswer(idx)}
              disabled={isAnswerChecked}
              className={cn(
                'w-full text-left flex items-center gap-3.5 p-3.5 rounded-xl border text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer',
                !isAnswerChecked &&
                  !isSelected &&
                  'bg-surface-container/40 border-outline-variant/10 text-on-surface hover:bg-surface-container-high/60 hover:border-outline-variant/30',
                !isAnswerChecked &&
                  isSelected &&
                  'bg-primary/10 border-primary/40 text-primary shadow-xs ring-1 ring-primary/20',
                isRevealCorrect &&
                  'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-xs ring-1 ring-emerald-500/20',
                isWrong &&
                  'bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-xs ring-1 ring-rose-500/20',
                isDimmed && 'opacity-35 border-transparent bg-transparent cursor-not-allowed'
              )}
            >
              {/* Key Badge */}
              <span
                className={cn(
                  'w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 transition-colors',
                  !isAnswerChecked && !isSelected && 'bg-surface-container-high text-on-surface-variant',
                  !isAnswerChecked && isSelected && 'bg-primary text-on-primary',
                  isRevealCorrect && 'bg-emerald-500 text-white',
                  isWrong && 'bg-rose-500 text-white',
                  isDimmed && 'bg-surface-container text-on-surface-variant/40'
                )}
              >
                {OPTION_KEYS[idx]}
              </span>

              <span className="leading-snug flex-1">{option}</span>

              {isRevealCorrect && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              {isWrong && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Footer controls */}
      <div className="shrink-0 pt-2 border-t border-outline-variant/10">
        {!isAnswerChecked ? (
          <Button
            type="button"
            onClick={checkAnswer}
            disabled={selectedAnswer === null}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-xl text-sm shadow-md shadow-primary/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            Valider la réponse
          </Button>
        ) : (
          <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-200">
            <div
              className={cn(
                'p-3.5 rounded-xl border text-xs leading-relaxed space-y-1',
                selectedAnswer === q.correctAnswerIndex
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
              )}
            >
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                {selectedAnswer === q.correctAnswerIndex ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Réponse correcte !</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Explication</span>
                  </>
                )}
              </div>
              <p className="text-on-surface-variant text-[11px] leading-relaxed">
                {q.explanation}
              </p>
            </div>

            <Button
              type="button"
              onClick={nextQuestion}
              className="w-full h-11 bg-surface-container-high hover:bg-surface-bright text-on-surface border border-outline-variant/20 font-bold rounded-xl text-xs gap-2 transition-all cursor-pointer active:scale-[0.99]"
            >
              {currentQuestionIndex < questions.length - 1 ? (
                <>
                  <span>Question suivante</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Voir mes résultats</span>
                  <Trophy className="w-3.5 h-3.5 text-primary" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
