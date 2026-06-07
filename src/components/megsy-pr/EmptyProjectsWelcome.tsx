import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import s1 from "@/assets/showcase/s1-dashboard.jpg";
import s2 from "@/assets/showcase/s2-ai-chat.jpg";
import s3 from "@/assets/showcase/s3-ecommerce.jpg";
import s4 from "@/assets/showcase/s4-mobile-app.jpg";
import s5 from "@/assets/showcase/s5-fintech.jpg";
import s6 from "@/assets/showcase/s6-portfolio.jpg";
import s7 from "@/assets/showcase/s7-social.jpg";
import s8 from "@/assets/showcase/s8-tasks.jpg";
import s9 from "@/assets/showcase/s9-ai-saas.jpg";
import s10 from "@/assets/showcase/s10-game.jpg";

export type ShowcaseItem = {
  id: string;
  title: string;
  tag: string;
  desc: string;
  bg: string;
  image: string;
  prompt: string;
};

const SHOWCASE: ShowcaseItem[] = [
  {
    id: "dashboard",
    title: "SaaS Dashboard",
    tag: "Dashboard · DB · Auth",
    desc: "Full analytics dashboards with charts and live data from your database.",
    bg: "#22c55e",
    image: s1,
    prompt:
      "Build a full-stack SaaS analytics dashboard with auth, Postgres tables (users, workspaces, events), KPI cards, time-series charts and a data table backed by Supabase queries, dark theme with purple accents.",
  },
  {
    id: "ai-chat",
    title: "AI Chatbot",
    tag: "AI · Realtime · Stream",
    desc: "Complete AI apps with saved conversations and streaming responses.",
    bg: "#a855f7",
    image: s2,
    prompt:
      "Build a ChatGPT-style AI chatbot: auth, sidebar of conversations, streaming LLM responses via an edge function, message persistence with RLS, code blocks and markdown rendering. Dark minimal UI.",
  },
  {
    id: "ecommerce",
    title: "E-commerce Store",
    tag: "Shop · Cart · Stripe",
    desc: "Online stores with catalog, cart and Stripe checkout out of the box.",
    bg: "#facc15",
    image: s3,
    prompt:
      "Build a full-stack fashion e-commerce store: product catalog from Postgres, product detail pages, persistent cart per user, Stripe Checkout via edge function, order history, and an admin to manage products. Premium light theme.",
  },
  {
    id: "mobile",
    title: "Mobile App",
    tag: "Mobile · Map · Orders",
    desc: "Mobile-first apps from food menus to live order tracking.",
    bg: "#f97316",
    image: s4,
    prompt:
      "Build a mobile-first food delivery app: auth, restaurants and menus in Postgres, cart, Stripe checkout, live order tracking with realtime subscriptions, and a restaurant admin panel. Bright orange theme.",
  },
  {
    id: "fintech",
    title: "Fintech App",
    tag: "Finance · Ledger · Charts",
    desc: "Finance apps with a real ledger and smart spending charts.",
    bg: "#10b981",
    image: s5,
    prompt:
      "Build a personal finance app: auth, accounts and transactions with double-entry ledger, CSV import via edge function, dashboard with balance, spending pie chart, monthly trend chart, and category management. Dark UI with neon green accents.",
  },
  {
    id: "portfolio",
    title: "3D Portfolio",
    tag: "Portfolio · 3D · Motion",
    desc: "Personal sites with 3D scenes and cinematic motion that turn heads.",
    bg: "#06b6d4",
    image: s6,
    prompt:
      "Build a cinematic personal portfolio with a Three.js hero scene, smooth Lenis scroll, magnetic buttons, parallax sections for About / Work / Process / Contact, and a sticky footer with neon accents on near-black.",
  },
  {
    id: "social",
    title: "Social Feed",
    tag: "Social · Realtime · Upload",
    desc: "Social networks with posts, photo uploads and realtime likes.",
    bg: "#ec4899",
    image: s7,
    prompt:
      "Build a social feed app: auth with avatars in storage, posts with image uploads, infinite-scroll feed, realtime likes and comments, follow/unfollow, and profile pages. Dark mobile-first UI.",
  },
  {
    id: "tasks",
    title: "Project Manager",
    tag: "Tasks · Kanban · Teams",
    desc: "Project tools with Kanban boards, teams and threaded comments.",
    bg: "#ef4444",
    image: s8,
    prompt:
      "Build a Linear-style project manager: auth, workspaces, projects, tasks with status/priority/assignee, drag-and-drop Kanban persisted to Postgres, comments, and a keyboard-driven dark UI.",
  },
  {
    id: "landing",
    title: "AI SaaS Landing",
    tag: "Landing · Marketing · CMS",
    desc: "AI-powered landing pages that sell your product at first glance.",
    bg: "#8b5cf6",
    image: s9,
    prompt:
      "Build a premium AI SaaS landing page: animated mesh-gradient hero with prompt input mock, social proof bar, how-it-works 3-step section, feature grid, pricing toggle, FAQ, and a strong final CTA.",
  },
  {
    id: "game",
    title: "Game Launch",
    tag: "Game · Cinematic · Hype",
    desc: "Cinematic game launch pages with countdowns and pre-order flows.",
    bg: "#0ea5e9",
    image: s10,
    prompt:
      "Build a AAA game launch page: cinematic looping background, animated logo, release countdown, gameplay feature reel, editions comparison, system requirements, and a pre-order CTA. Neon gradient on near-black.",
  },
];

interface Props {
  onPick?: (item: ShowcaseItem) => void;
}

export default function EmptyProjectsWelcome({ onPick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const scrollByDir = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth;
    const idx = Math.round(el.scrollLeft / step);
    setActiveIdx(Math.max(0, Math.min(SHOWCASE.length - 1, idx)));
  };

  return (
    <section className="w-full">
      {/* Header */}
      <div className="flex flex-col items-center text-center px-4 py-10 md:py-14">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground mb-3"
        >
          From idea to live app
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-display uppercase text-3xl md:text-5xl font-black leading-[1.05] tracking-tight text-foreground"
        >
          We generate
          <br />
          <span className="text-foreground/40">everything.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mt-4 max-w-md text-sm md:text-base text-muted-foreground"
        >
          Dashboards, AI apps, stores, mobile, fintech, social networks, games —
          Megsy ships them full-stack with auth, database and a polished UI ready to deploy.
        </motion.p>
      </div>

      {/* Scroll rail */}
      <div className="relative">
        <button
          onClick={() => scrollByDir(-1)}
          aria-label="Previous"
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur border border-foreground/15 text-foreground shadow-lg hover:bg-background"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => scrollByDir(1)}
          aria-label="Next"
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur border border-foreground/15 text-foreground shadow-lg hover:bg-background"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto px-4 pb-6 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {SHOWCASE.map((t, i) => (
            <motion.button
              key={t.id}
              data-card
              onClick={() => onPick?.(t)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3) }}
              className="snap-center shrink-0 w-[78vw] sm:w-[420px] md:w-[460px] rounded-[28px] overflow-hidden text-left transition-transform duration-300 active:scale-[0.98] hover:-translate-y-1"
              style={{ background: t.bg }}
            >
              <div className="p-4 md:p-5">
                <div className="relative aspect-[16/11] w-full overflow-hidden rounded-2xl bg-black/10 ring-1 ring-black/10">
                  <img
                    src={t.image}
                    alt={t.title}
                    loading="lazy"
                    width={1024}
                    height={704}
                    className="absolute inset-0 h-full w-full object-cover object-top"
                  />
                </div>
                <h3 className="mt-4 font-display uppercase text-2xl md:text-3xl font-black leading-[0.95] tracking-tight text-black">
                  {t.title}
                </h3>
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-black/65">
                  {t.tag}
                </p>
                <p
                  className="mt-2 text-[13px] leading-snug text-black/75"
                  dir="auto"
                >
                  {t.desc}
                </p>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 pt-1 pb-4">
          {SHOWCASE.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIdx ? "w-6 bg-foreground" : "w-1.5 bg-foreground/25"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
