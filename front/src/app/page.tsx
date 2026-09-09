import { UrlInput } from "@/components/UrlInput";
import { RevealSection } from "@/components/reveal-section";
import type { Metadata } from "next";
import Image from "next/image";

/* ─── SVG Icon Components ─── */
const IconBrain = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
    <path d="M12 2a7 7 0 0 0-4.6 12.3A4.5 4.5 0 0 0 9.5 22h5a4.5 4.5 0 0 0 2.1-7.7A7 7 0 0 0 12 2Z" />
    <path d="M12 2v20M8 6h8M7 10h10M8 14h8M9.5 18h5" strokeOpacity=".5" />
  </svg>
);

const IconNotebook = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <path d="M8 6h8M8 10h8M8 14h5" strokeOpacity=".7" />
    <path d="M4 6H2M4 10H2M4 14H2M4 18H2" />
  </svg>
);

const IconQuiz = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
    <circle cx="12" cy="12" r="10" />
    <path d="M9 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
  </svg>
);

const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M8 5v14l11-7z" />
  </svg>
);

/* ─── Data ─── */
const FEATURES = [
  { icon: <IconBrain />, title: "Décryptage IA", desc: "Analyse approfondie de sujets complexes, divisés automatiquement en blocs faciles à assimiler.", color: "#93b7ff" },
  { icon: <IconNotebook />, title: "Notes Intelligentes", desc: "Annotez les vidéos en temps réel et exportez vos résumés directement vers Notion ou Obsidian.", color: "#ffb8ac" },
  { icon: <IconQuiz />, title: "Mode Quiz", desc: "Testez vos connaissances grâce à des quiz générés par l'IA et adaptés au contenu de la vidéo.", color: "#ffc78f" },
];

const STEPS = [
  { num: "01", title: "Collez un lien", desc: "Insérez n'importe quelle URL YouTube dans SmartTube. Notre IA commence instantanément à traiter le contenu." },
  { num: "02", title: "Apprenez activement", desc: "Obtenez des transcriptions, des points clés et un assistant IA qui répond à toutes vos questions sur la vidéo." },
  { num: "03", title: "Maîtrisez & Retenez", desc: "Faites des quiz générés par l'IA, passez en revue les explications et suivez votre progression au fil du temps." },
];

const STATS = [
  { value: "10K+", label: "Apprenants Actifs" },
  { value: "2.4M", label: "Vidéos Analysées" },
  { value: "94%", label: "Taux de Rétention" },
  { value: "4.9★", label: "Note Utilisateurs" },
];

export const metadata: Metadata = {
  title: "SmartTube | Transformez n'importe quelle vidéo en leçon structurée",
  description: "Fini le visionnage passif. Place à l'apprentissage actif. Générez instantanément des résumés par IA, des transcriptions interactives et des quiz sur mesure.",
};

/* ═══════════════════════════════════════════
   LANDING PAGE (Server Component)
   ═══════════════════════════════════════════ */
export default function Home() {
  return (
    <div className="min-h-screen bg-[#0b0b0d] text-[#f2f2f3]">
      <style>{`
        .reveal-section {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.7s ease-out, transform 0.7s ease-out;
        }
        .reveal-section.revealed {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

      <main>
        {/* ══════ HERO ══════ */}
        <section className="relative overflow-hidden min-h-screen pb-8 pt-16 md:pb-16 md:pt-28 hero-gradient" id="url-input-section">
          {/* Ambient glow */}
          <div className="absolute top-0 right-0 -z-10 opacity-20">
            <div className="w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3"></div>
          </div>
          <div className="relative mx-auto max-w-6xl px-5 md:px-8">
            <div className="mx-auto max-w-4xl text-center">
              {/* Title */}
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 leading-[1.1]">
                Transformez toutes vidéos en une <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-primary-container">leçon structurée.</span>
              </h1>

              {/* Subtitle */}
              <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-white/55 md:text-lg">
                Fini le visionnage passif. Place à l'apprentissage actif. Collez un lien pour générer
                instantanément des transcriptions, des notes propulsées par l'IA et des quiz personnalisés.
              </p>

              {/* URL Input Form Component */}
              <UrlInput />
            </div>
          </div>
        </section>

        {/* ══════ FEATURES ══════ */}
        <section id="features" className="relative py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <RevealSection>
              <div className="mb-12 text-center">
                <p className="text-label text-[#ffb4a8]">Fonctionnalités clés</p>
                <h2 className="mt-3 text-headline text-white">Votre boîte à outils d'apprentissage propulsée par l'IA</h2>
              </div>
            </RevealSection>

            <div className="grid gap-10 md:grid-cols-3">
              {FEATURES.map((f, i) => (
                <RevealSection key={f.title} delay={i * 120}>
                  <article className="group relative rounded-2xl bg-[#111115] p-7 transition-all duration-300 hover:bg-[#141419]">
                    {/* Hover glow */}
                    <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: `radial-gradient(circle at 30% 30%, ${f.color}08, transparent 60%)` }} />
                    <div className="relative">
                      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${f.color}15`, color: f.color }}>
                        {f.icon}
                      </div>
                      <h3 className="text-xl font-semibold text-white">{f.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-white/50">{f.desc}</p>
                    </div>
                  </article>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* ══════ SHOWCASE ══════ */}
        <section className="relative py-8 md:py-16">
          <div className="mx-auto max-w-5xl px-5 md:px-8">
            <RevealSection>
              <div className="relative overflow-hidden rounded-3xl bg-[#0e0f12]">
                <div className="relative h-[420px] w-full bg-gradient-to-b from-[#1a1c22] via-[#15171c] to-[#0e0f12]">
                  {/* Ambient light */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,_rgba(255,255,255,0.06),_transparent_50%)]" />

                  {/* Mock UI preview */}
                    
                      {/* Content */}
                      <div className="relative w-full overflow-hidden bg-[#0c0d10]" style={{ aspectRatio: "2800/1155" }}>
                        <Image
                          src="/img.png"
                          alt="SmartTube Interface"
                          fill
                          className="object-cover object-top"
                          priority
                        />
                      </div>

                </div>
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ══════ HOW IT WORKS ══════ */}
        <section id="how-it-works" className="relative py-16 md:py-28">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <RevealSection>
              <div className="mb-16 text-center">
                <p className="text-label text-[#acc7ff]">Comment ça marche</p>
                <h2 className="mt-3 text-headline text-white">Trois étapes vers la maîtrise</h2>
              </div>
            </RevealSection>

            <div className="grid gap-8 md:grid-cols-3 md:gap-1">
              {STEPS.map((s, i) => (
                <RevealSection key={s.num} delay={i * 150}>
                  <div className="group relative rounded-2xl bg-[#0f1014] p-8 transition-all duration-300 hover:bg-[#111116]">
                    <span className="gradient-primary-text text-5xl font-black opacity-20 transition-opacity duration-300 group-hover:opacity-40">{s.num}</span>
                    <h3 className="mt-4 text-xl font-semibold text-white">{s.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-white/45">{s.desc}</p>
                    {i < STEPS.length - 1 && (
                      <div className="pointer-events-none absolute -right-4 top-1/2 hidden h-px w-8 bg-gradient-to-r from-white/10 to-transparent md:block" />
                    )}
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* ══════ FINAL CTA ══════ */}
        <section className="relative py-16 md:py-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_100%,_rgba(255,85,64,0.1),_transparent_60%)]" />
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <RevealSection>
              <div className="relative mx-auto max-w-3xl text-center">
                <h2 className="text-headline md:text-4xl text-white">
                  Prêt à apprendre plus <span className="gradient-primary-text">intelligemment ?</span>
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base text-white/50">
                  Rejoignez des milliers d'étudiants qui ont transformé leurs habitudes d'étude avec SmartTube.
                </p>
                <a
                  href="#url-input-section"
                  className="mt-8 inline-flex items-center gap-2 rounded-sm px-8 py-3.5 text-sm font-bold gradient-primary text-[#2b140f] shadow-[0_8px_32px_rgba(255,85,64,0.25)] transition-all duration-200 hover:shadow-[0_16px_48px_rgba(255,85,64,0.3)] hover:scale-[1.03] active:scale-[0.98]"
                >
                  Commencer à apprendre — C'est gratuit
                  <IconArrow />
                </a>
              </div>
            </RevealSection>
          </div>
        </section>
      </main>

      {/* ══════ FOOTER ══════ */}
      <footer className="bg-[#0a0a0c]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 px-5 py-10 md:flex-row md:px-8">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md gradient-primary">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3"><path d="M8 5v14l11-7z" /></svg>
              </div>
              <span className="text-sm font-black tracking-tight text-[#ff8f87]">SMARTTUBE</span>
            </div>
            <p className="mt-2 text-xs text-white/35">
              © {new Date().getFullYear()} Study Sanctuary Inc. Tous droits réservés.
            </p>
          </div>
          <nav className="flex items-center gap-6 text-sm text-white/45">
            <a href="#" className="transition-colors hover:text-white/75">Confidentialité</a>
            <a href="#" className="transition-colors hover:text-white/75">Conditions d'utilisation</a>
            <a href="#" className="transition-colors hover:text-white/75">Contact</a>
          </nav>
          <div className="flex gap-2">
            {/* Twitter / X */}
            <a href="#" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </a>
            {/* GitHub */}
            <a href="#" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" /></svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
