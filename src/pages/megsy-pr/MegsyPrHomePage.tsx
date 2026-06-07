// @ts-nocheck — imported design from external repo; backend wiring deferred.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUp, Plus, Loader2, Paperclip, Palette, Database, ChevronRight, ChevronDown, X,
  Image as ImageIcon, FileText, Check, Code2, MessageSquare, Film, Smartphone, Monitor
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { BUILD_SEED_FILES } from "@/lib/buildSeedFiles";
import AppSidebar from "@/components/layout/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useUserPlan } from "@/hooks/useUserPlan";
import { Eye, Sparkles } from "lucide-react";
import SEOHead from "@/components/common/SEOHead";
import LazyVideo from "@/components/landing/LazyVideo";
import { StarsBackground } from "@/components/animate-ui/components/backgrounds/stars";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import PromptsGallery from "@/components/megsy-pr/PromptsGallery";



const ROTATING_PROMPTS: string[] = [];

const DESIGN_THEMES = [
  { id: "ios-ui", name: "iOS UI 26.5", gradient: "linear-gradient(135deg, #0A84FF 0%, #5E5CE6 55%, #FF375F 100%)" },
  { id: "megsy-ui", name: "Megsy UI", gradient: "linear-gradient(135deg, #A855F7 0%, #EC4899 55%, #F59E0B 100%)" },
  { id: "minimal", name: "Minimal Mono", gradient: "linear-gradient(135deg, #0F172A 0%, #475569 55%, #E2E8F0 100%)" },
  { id: "neon", name: "Neon Cyber", gradient: "linear-gradient(135deg, #22D3EE 0%, #A78BFA 55%, #F472B6 100%)" },
];

const GREETINGS = [
  "Ready to build", "Let's create something", "What's the vision", "Time to ship",
  "Dream it, build it", "What are we making", "Let's get started", "Ready to ship",
  "Let's build magic", "What's next", "Cook something amazing", "Let's craft it",
  "Bring an idea to life", "What shall we build", "Let's make it real",
  "Ready when you are", "Imagine and build", "Pick up where you left off",
  "Build something bold", "What sparks today", "Let's prototype", "Make it happen",
  "Time to create", "Let's dream up something", "Ready to invent", "What's brewing",
  "Let's design it", "From idea to app", "Build with intent", "Let's iterate",
  "What's the move", "Plan, build, ship", "Ready to launch", "Let's hack on it",
  "What if we built", "Build the future", "Let's spin it up", "Sketch an app",
  "Make something great", "Let's wire it up", "What's cooking", "Ready to roll",
  "Let's compose it", "Pixels to product", "Concept to code", "Let's tinker",
  "Build something delightful", "Whip up an app", "Let's draft it",
  "Bring it to life", "Make today productive", "Ready to ideate",
  "Let's craft something neat", "What's the spark", "Code something cool",
];

type AttachedFile = { name: string; type: string; url?: string };

export default function MegsyPrHomePage() {
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed] = useSidebarCollapsed();
  const { plan: userPlan } = useUserPlan();
  const [plusOpen, setPlusOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<null | "design" | "database">(null);
  const [userName, setUserName] = useState<string>("");
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [platform, setPlatform] = useState<"web" | "ios" | "android">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("megsy_pr_platform") as any) || "web";
    return "web";
  });
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("megsy_pr_platform", platform); }, [platform]);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [linkedProject, setLinkedProject] = useState<{ ref: string; name: string } | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window === "undefined") return "megsy";
    return localStorage.getItem("megsy_pr_model") || "megsy";
  });
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("megsy_pr_model", selectedModel);
  }, [selectedModel]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  // Close plus menu when clicking outside
  useEffect(() => {
    if (!plusOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        setPlusOpen(false);
        setActivePanel(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [plusOpen]);

  // Animated typing placeholder
  const [phIdx, setPhIdx] = useState(0);
  const [phText, setPhText] = useState("");
  useEffect(() => {
    if (input) return;
    const target = ROTATING_PROMPTS[phIdx] ?? "";
    if (!target) return;
    let i = 0;
    setPhText("");
    const typer = setInterval(() => {
      i++;
      setPhText(target.slice(0, i));
      if (i >= target.length) {
        clearInterval(typer);
        setTimeout(() => setPhIdx((v) => (v + 1) % ROTATING_PROMPTS.length), 1800);
      }
    }, 55);
    return () => clearInterval(typer);
  }, [phIdx, input]);

  // Prefill prompt from ?prompt= (e.g. coming from a template Remix)
  useEffect(() => {
    const p = searchParams.get("prompt");
    if (p) {
      setInput(p);
      const next = new URLSearchParams(searchParams);
      next.delete("prompt");
      setSearchParams(next, { replace: true });
      setTimeout(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load user name
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      setUserName(prof?.display_name || (user.user_metadata?.full_name as string) || (user.email?.split("@")[0] ?? "there"));
    })();

    // Detect Supabase return
    const ref = localStorage.getItem("megsy_pending_supabase_ref");
    const name = localStorage.getItem("megsy_pending_supabase_name");
    if (ref && name) {
      setLinkedProject({ ref, name });
      localStorage.removeItem("megsy_pending_supabase_ref");
      localStorage.removeItem("megsy_pending_supabase_name");
    }
  }, []);

  // Load user's recent projects to show under composer
  const [recentProjects, setRecentProjects] = useState<Array<{ id: string; name: string; description: string | null; updated_at: string; thumbnail_url: string | null; preview_url: string | null; published_url: string | null }>>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const refreshRecentProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProjectsLoading(false); return; }
    const { data } = await supabase
      .from("projects")
      .select("id, name, description, updated_at, thumbnail_url, preview_url, published_url")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(12);
    if (data) {
      setRecentProjects(data as any);
      // For projects that still have no saved thumbnail but do have a
      // preview/published URL, persist the cached mshots screenshot URL once.
      // From then on the gallery loads a stable static image instead of
      // hitting the live preview every visit.
      const needsShot = (data as any[]).filter(
        (p) => !p.thumbnail_url && (p.published_url || p.preview_url)
      );
      needsShot.forEach((p) => {
        const url = p.published_url || p.preview_url;
        const shotUrl = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1280&h=800`;
        supabase
          .from("projects")
          .update({ thumbnail_url: shotUrl })
          .eq("id", p.id)
          .then(() => {});
      });
    }
    setProjectsLoading(false);
  };
  useEffect(() => { refreshRecentProjects(); }, []);

  // Auto-load Supabase projects when opening database panel (if account already linked)
  useEffect(() => {
    if (activePanel !== "database" || linkedProject || supabaseProjects !== null) return;
    (async () => {
      const { data } = await supabase.functions.invoke("supabase-link-manager", { body: { action: "status" } });
      if (data?.connected) await fetchProjects();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel]);

  const handleAttachFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const next: AttachedFile[] = Array.from(fileList).map((f) => ({
      name: f.name, type: f.type, url: URL.createObjectURL(f),
    }));
    setFiles((prev) => [...prev, ...next]);
    setPlusOpen(false);
    setActivePanel(null);
  };

  const [connectingSupabase, setConnectingSupabase] = useState(false);
  const [supabaseProjects, setSupabaseProjects] = useState<Array<{ id: string; name: string }> | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const fetchProjects = async (): Promise<boolean> => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase.functions.invoke("supabase-link-manager", {
        body: { action: "list_projects" },
      });
      if (error || data?.error) return false;
      const projects = (data?.projects || []) as Array<{ id: string; name: string }>;
      setSupabaseProjects(projects);
      if (projects.length === 0) toast.message("No Supabase projects found in your account");
      return true;
    } finally {
      setLoadingProjects(false);
    }
  };

  const connectSupabase = async () => {
    if (connectingSupabase) return;
    setConnectingSupabase(true);
    try {
      // 1) If account is already linked, just pick a project.
      const { data: statusData } = await supabase.functions.invoke("supabase-link-manager", {
        body: { action: "status" },
      });
      if (statusData?.connected) {
        const ok = await fetchProjects();
        if (ok) toast.success("Supabase connected");
        return;
      }

      // 2) Otherwise start OAuth using our stored keys.
      const { data, error } = await supabase.functions.invoke("supabase-oauth-start", {
        body: { redirect_to: window.location.href },
      });
      if (error) throw error;
      const authorizeUrl = data?.authorize_url;
      if (!authorizeUrl) throw new Error("Missing authorize URL");

      const popup = window.open(authorizeUrl, "supabase-oauth", "width=600,height=750");
      if (!popup) { window.location.href = authorizeUrl; return; }
      toast.success("Opening Supabase authorization...");

      const cleanup = (timer: number, listener: (e: MessageEvent) => void) => {
        clearInterval(timer);
        window.removeEventListener("message", listener);
        setConnectingSupabase(false);
      };

      const listener = async (ev: MessageEvent) => {
        if (ev.data?.type !== "supabase-oauth") return;
        if (ev.data.ok) {
          const ok = await fetchProjects();
          if (ok) toast.success("Supabase connected");
        } else {
          toast.error("Failed to connect Supabase");
        }
        cleanup(poll, listener);
        try { popup.close(); } catch { /* noop */ }
      };
      window.addEventListener("message", listener);

      const poll = window.setInterval(async () => {
        if (popup.closed) {
          // Popup closed without postMessage — verify status as a fallback
          const { data: s } = await supabase.functions.invoke("supabase-link-manager", {
            body: { action: "status" },
          });
          if (s?.connected) {
            const ok = await fetchProjects();
            if (ok) toast.success("Supabase connected");
          }
          cleanup(poll, listener);
        }
      }, 1500);

      window.setTimeout(() => cleanup(poll, listener), 120000);
    } catch (e) {
      toast.error("Failed to connect Supabase");
      setConnectingSupabase(false);
    }
  };


  const startNew = async () => {
    const prompt = input.trim();
    if (!prompt || creating) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to continue");
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!userPlan || userPlan === "free") {
      toast.error("A subscription is required to build apps. Please choose a plan.", {
        description: "Building with Megsy needs an active Starter, Pro, Elite, or Business plan.",
        action: { label: "View plans", onClick: () => navigate("/pricing") },
      });
      navigate("/pricing");
      return;
    }
    setCreating(true);
    try {

      let fullPrompt = prompt;
      const hidden: string[] = [];
      const platformLabel = platform === "ios" ? "iOS App (native-feel SwiftUI-style React Native preview)" : platform === "android" ? "Android App (Material You-style React Native preview)" : "Full-stack web app (React + Vite + Tailwind + Supabase)";
      hidden.push(`[Target platform: ${platformLabel}]`);
      if (selectedTheme) {
        const t = DESIGN_THEMES.find((x) => x.id === selectedTheme);
        if (t) hidden.push(`[Design preference: ${t.name}]`);
      }
      if (linkedProject) {
        hidden.push(`[Supabase project linked: ${linkedProject.name} (${linkedProject.ref}) — write backend code from start]`);
      }
      if (files.length) {
        hidden.push(`[Attachments: ${files.map((f) => f.name).join(", ")}]`);
      }
      if (hidden.length) fullPrompt = `${prompt}\n\n${hidden.join("\n")}`;

      let aiName = prompt.split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
      try {
        const { data: nameResult, error: nameError } = await supabase.functions.invoke("build-agent", {
          body: { action: "suggest_name", prompt },
        });
        if (!nameError && nameResult?.ok && nameResult?.data?.name) {
          aiName = String(nameResult.data.name).trim() || aiName;
        }
      } catch {
        // fallback to prompt-derived short name
      }

      const insertPayload: any = {
        user_id: user.id, name: aiName.slice(0, 60), description: prompt, status: "active",
      };
      if (linkedProject) {
        insertPayload.linked_supabase_project_ref = linkedProject.ref;
        insertPayload.linked_supabase_project_name = linkedProject.name;
      }
      const { data, error } = await supabase
        .from("projects").insert(insertPayload).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "Failed to create");

      const seedRows = BUILD_SEED_FILES.map((f) => ({
        project_id: data.id, path: f.path, content: f.content,
      }));
      for (let i = 0; i < seedRows.length; i += 25) {
        const { error: seedErr } = await supabase
          .from("ai_project_files")
          .upsert(seedRows.slice(i, i + 25), { onConflict: "project_id,path" });
        if (seedErr) throw new Error(`Seed failed: ${seedErr.message}`);
      }

      navigate(`/build/${data.id}/chat?prompt=${encodeURIComponent(fullPrompt)}`);
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
    <SEOHead
      title="Build AI Apps & Websites with Megsy — Code with AI in Minutes"
      description="Create production-ready apps and websites with AI. Describe what you want, watch Megsy code, deploy and scale it — no setup, no boilerplate, no DevOps."
      path="/code"
    />
    <div className="h-[100dvh] flex overflow-hidden">
      <StarsBackground
        starColor={resolvedTheme === "dark" ? "#FFF" : "#000"}
        className={cn(
          "fixed inset-0 -z-10 pointer-events-none",
          "dark:bg-[radial-gradient(ellipse_at_bottom,_#262626_0%,_#000_100%)] bg-[radial-gradient(ellipse_at_bottom,_#f5f5f5_0%,_#fff_100%)]",
        )}
      />

      {/* Desktop persistent sidebar */}
      <aside
        style={{ width: sidebarCollapsed ? 60 : 280 }}
        className="hidden md:flex shrink-0 overflow-hidden border-r border-border/70 bg-white dark:bg-black transition-[width] duration-200 ease-out"
      >
        <AppSidebar
          inline
          open
          onClose={() => {}}
          onNewChat={() => navigate("/chat")}
          currentMode="megsy-pr"
        />
      </aside>

      {/* Mobile drawer sidebar */}
      <div className="md:hidden">
        <AppSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNewChat={() => navigate("/chat")}
          currentMode="megsy-pr"
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative overflow-y-auto isolate text-foreground">
        <StarsBackground
          starColor={resolvedTheme === "dark" ? "#FFF" : "#000"}
          className={cn(
            "fixed inset-0 -z-10 pointer-events-none",
            "dark:bg-[radial-gradient(ellipse_at_bottom,_#262626_0%,_#000_100%)] bg-[radial-gradient(ellipse_at_bottom,_#f5f5f5_0%,_#fff_100%)]",
          )}
        />
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" style={{ display: 'none' }}>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(900px 520px at 50% -10%, hsl(var(--primary) / 0.10), transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.05] dark:opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(to right, hsl(var(--foreground) / 0.6) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground) / 0.6) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage: "radial-gradient(ellipse 70% 50% at 50% 25%, #000 30%, transparent 80%)",
              WebkitMaskImage: "radial-gradient(ellipse 70% 50% at 50% 25%, #000 30%, transparent 80%)",
            }}
          />
        </div>


      {/* Mobile header */}
      <header className="md:hidden relative z-10 px-5 pt-4 pb-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="ios-fab w-11 h-11 rounded-full flex items-center justify-center text-foreground"
          aria-label="Open menu"
        >
          <ChevronRight className="w-[22px] h-[22px] mobile-header-icon-black" strokeWidth={2.25} />
        </button>
        <div className="flex items-center gap-1.5">
        </div>
        <div className="w-10 h-10" />
      </header>

      {/* Greeting + Input centered */}
      <main className="relative z-10 flex flex-col items-center justify-start min-h-[calc(100dvh-120px)] px-4 pt-6 md:pt-0 md:min-h-0">

      {/* Mobile hero — refined soft, breathable */}
      <div className="md:hidden w-full mb-10 text-left px-2">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="font-display uppercase text-[40px] leading-[0.92] tracking-tight text-foreground font-black"
        >
          What will<br />you{" "}
          <span className="text-primary">build</span>
          <span className="text-foreground/30">?</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-4 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground"
        >
          Create with precision
        </motion.p>
      </div>

      {/* Desktop hero — landing-style uppercase display, chat-style soft composer below */}
      <div className="hidden md:block w-full max-w-[960px] mx-auto px-0 pt-24 pb-10 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="font-display uppercase text-[5.5vw] leading-[0.95] tracking-tight text-foreground"
        >
          What will you{" "}
          <span className="text-primary">build</span>
          <span className="text-foreground/30">?</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground"
        >
          From idea to live app. One prompt away.
        </motion.p>
      </div>

      <div ref={composerRef} className="relative w-full max-w-xl md:max-w-[820px] z-20 group">
        {/* Spotlight focus glow */}
        <div
          aria-hidden
          className="absolute -inset-1 bg-gradient-to-r from-purple-500/25 to-indigo-500/25 rounded-[32px] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none"
        />
        {/* Desktop: gradient border wrapper (matches Media Hub) */}
        <div className="relative md:rounded-[26px] md:p-[1px] md:bg-gradient-to-b md:from-white/[0.14] md:to-white/[0.04]">

        <div
          className="rounded-[28px] p-4 border border-foreground/10 md:rounded-[25px] md:p-3.5 md:bg-card md:border-foreground/[0.02]"
          style={{
            background: "hsl(var(--card) / 0.88)",
            backdropFilter: "blur(28px) saturate(180%)",
            WebkitBackdropFilter: "blur(28px) saturate(180%)",
            boxShadow: "0 8px 32px -10px rgba(0,0,0,0.12)",
          }}
        >
          {/* Pills */}
          {(selectedTheme || linkedProject || files.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {selectedTheme && (
                <Pill
                  label={DESIGN_THEMES.find((t) => t.id === selectedTheme)?.name ?? "Design"}
                  icon={<Palette className="w-3 h-3" />}
                  onRemove={() => setSelectedTheme(null)}
                />
              )}
              {linkedProject && (
                <Pill
                  label={`Supabase · ${linkedProject.name}`}
                  icon={<Database className="w-3 h-3" />}
                  onRemove={() => setLinkedProject(null)}
                />
              )}
              {files.map((f, i) => (
                <Pill
                  key={i}
                  label={f.name}
                  icon={f.type.startsWith("image") ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                  onRemove={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          )}

          {/* Textarea with animated placeholder + auto-grow */}
          <div className="relative min-h-[44px]">
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = e.currentTarget;
                el.style.height = "0px";
                el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && (typeof window === 'undefined' || window.innerWidth >= 768)) {
                  e.preventDefault();
                  startNew();
                }
              }}
              rows={1}
              className="w-full bg-transparent resize-none text-[15px] outline-none placeholder:text-transparent leading-relaxed overflow-y-auto max-h-[320px]"
            />
            {!input && (
              <div className="absolute inset-0 pointer-events-none text-[15px] text-muted-foreground leading-relaxed">
                {phText}
              </div>
            )}
          </div>


          {/* Platform selector — clean segmented control */}
          <div className="mt-3 -mx-1 px-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {([
              { id: "web", label: "Full-stack Web", Icon: Monitor },
              { id: "ios", label: "iOS App", Icon: Smartphone },
              { id: "android", label: "Android App", Icon: Smartphone },
            ] as const).map(({ id, label, Icon }) => {
              const active = platform === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlatform(id)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium transition-all border",
                    active
                      ? "bg-foreground text-background border-foreground shadow-sm"
                      : "bg-foreground/[0.03] text-foreground/65 border-foreground/10 hover:text-foreground hover:bg-foreground/[0.06]"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.9} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Bottom controls */}
          <div className="flex items-center justify-between mt-2 gap-2">
            <button
              onClick={() => { setPlusOpen((v) => !v); setActivePanel(null); }}
              className="w-9 h-9 rounded-full grid place-items-center hover:bg-foreground/5 transition md:w-10 md:h-10 md:rounded-2xl md:ios26-glass md:text-foreground/85 md:hover:text-foreground shrink-0"
              aria-label="More"
            >
              <Plus className={`w-5 h-5 transition-transform ${plusOpen ? "rotate-45" : ""}`} />
            </button>

            <div className="flex-1" />

            {/* Model picker — compact button + popover */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setModelPickerOpen((v) => !v)}
                className="h-9 md:h-10 px-3 rounded-full inline-flex items-center gap-1.5 border border-foreground/10 bg-foreground/[0.03] hover:bg-foreground/[0.06] text-[12px] font-medium text-foreground/85 transition"
                aria-label="Select model"
              >
                <span className="truncate max-w-[110px]">
                  {selectedModel === "sonnet" ? "Sonnet 4.6" : selectedModel === "opus" ? "Opus 4.8" : "Default"}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${modelPickerOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {modelPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setModelPickerOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="absolute top-full mt-2 right-0 z-40 w-52 rounded-2xl border border-foreground/10 overflow-hidden p-1.5"
                      style={{
                        background: "hsl(var(--card) / 0.95)",
                        backdropFilter: "blur(24px) saturate(180%)",
                        WebkitBackdropFilter: "blur(24px) saturate(180%)",
                        boxShadow: "0 12px 36px -10px rgba(0,0,0,0.18)",
                      }}
                    >
                      {[
                        { id: "sonnet", label: "Claude Sonnet 4.6", desc: "Fast · balanced" },
                        { id: "opus",   label: "Claude Opus 4.8",   desc: "Most capable" },
                        { id: "megsy",  label: "Default",           desc: "Default · tuned" },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { setSelectedModel(m.id); setModelPickerOpen(false); }}
                          className={`w-full text-left px-3 py-2 rounded-xl transition flex items-start gap-2 ${
                            selectedModel === m.id ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.04]"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-foreground truncate">{m.label}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{m.desc}</p>
                          </div>
                          {selectedModel === m.id && <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={startNew}
              disabled={!input.trim() || creating}
              className="w-10 h-10 rounded-full grid place-items-center bg-foreground text-background hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-lg md:w-11 md:h-11 shrink-0"
              aria-label="Send"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-5 h-5" strokeWidth={2.5} />}
            </button>
          </div>

        </div>
        </div>{/* /gradient border wrapper */}


        {/* Plus menu — matches input bar style */}
        <AnimatePresence>
          {plusOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="absolute left-0 right-0 top-full mt-2 rounded-[28px] border border-foreground/10 overflow-hidden z-30"
              style={{
                background: "hsl(var(--card) / 0.88)",
                backdropFilter: "blur(28px) saturate(180%)",
                WebkitBackdropFilter: "blur(28px) saturate(180%)",
                boxShadow: "0 8px 32px -10px rgba(0,0,0,0.12)",
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {!activePanel && (
                  <motion.div
                    key="root"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="p-2"
                  >
                    <PlusItem icon={<Paperclip className="w-4 h-4" />} label="Attach" hideArrow onClick={() => { fileInputRef.current?.click(); setPlusOpen(false); }} />
                    <PlusItem icon={<Palette className="w-4 h-4" />} label="Design" onClick={() => setActivePanel("design")} />
                    <PlusItem icon={<Database className="w-4 h-4" />} label="Database" onClick={() => setActivePanel("database")} />
                  </motion.div>
                )}

                {activePanel === "design" && (
                  <motion.div
                    key="design"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="p-4"
                  >
                    <button onClick={() => setActivePanel(null)} className="text-xs text-muted-foreground mb-3 flex items-center gap-1 hover:text-foreground transition">
                      ‹ Back
                    </button>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Choose a design</p>
                    <div className="grid grid-cols-2 gap-2">
                      {DESIGN_THEMES.map((t, i) => (
                        <motion.button
                          key={t.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.04 * i, duration: 0.2 }}
                          onClick={() => { setSelectedTheme(t.id); setPlusOpen(false); setActivePanel(null); }}
                          className={`rounded-2xl p-3 text-start transition border ${
                            selectedTheme === t.id ? "border-foreground/40 bg-foreground/5" : "border-foreground/10 hover:bg-foreground/5"
                          }`}
                        >
                          <div
                            className="w-full aspect-[4/3] rounded-xl mb-2 border border-foreground/10 shadow-inner"
                            style={{ background: t.gradient }}
                          />
                          <p className="text-xs font-semibold">{t.name}</p>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activePanel === "database" && (
                  <motion.div
                    key="database"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="p-4"
                  >
                    <button onClick={() => setActivePanel(null)} className="text-xs text-muted-foreground mb-3 flex items-center gap-1 hover:text-foreground transition">
                      ‹ Back
                    </button>
                    
                    {linkedProject ? (
                      <div className="rounded-2xl p-3 border border-foreground/10 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/15 grid place-items-center text-green-600">
                          <Check className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{linkedProject.name}</p>
                          <p className="text-[11px] text-muted-foreground">Connected · context will be sent</p>
                        </div>
                        <button
                          onClick={() => { setLinkedProject(null); fetchProjects(); }}
                          className="text-[11px] text-muted-foreground hover:text-foreground transition"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={connectSupabase}
                          disabled={connectingSupabase}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-foreground/5 transition text-start disabled:opacity-60"
                        >
                          <span className="text-foreground/70">
                            {connectingSupabase ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                          </span>
                          <span className="flex-1 text-sm font-medium">
                            {connectingSupabase ? "Connecting..." : supabaseProjects ? "Reconnect Supabase" : "Connect to Supabase"}
                          </span>
                        </button>

                        {supabaseProjects && supabaseProjects.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground px-1 mb-1">Your projects</p>
                            {supabaseProjects.map((p, i) => (
                              <motion.div
                                key={p.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.03 * i, duration: 0.18 }}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-foreground/10"
                              >
                                <Database className="w-4 h-4 text-foreground/60" />
                                <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
                                <button
                                  onClick={() => {
                                    setLinkedProject({ ref: p.id, name: p.name });
                                    toast.success(`Connected to ${p.name}`);
                                  }}
                                  className="text-xs font-semibold px-3 py-1 rounded-full bg-foreground text-background hover:opacity-90 transition"
                                >
                                  Connect
                                </button>
                              </motion.div>
                            ))}
                          </div>
                        )}
                        {loadingProjects && (
                          <div className="mt-2 flex items-center justify-center py-2 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => handleAttachFiles(e.target.files)}
        />
      </div>

      {/* Tabs: Projects / Prompts */}
      <section className="relative z-10 w-full max-w-3xl md:max-w-6xl mt-16 md:mt-20 mb-24 px-1">
        <ProjectsTemplatesTabs
          projects={recentProjects}
          projectsLoading={projectsLoading}
          isPro={userPlan === "pro" || userPlan === "business" || userPlan === "enterprise"}
          onOpenProject={(id) => navigate(`/build/${id}`)}
          onRemixProject={async (id) => {
            const t = toast.loading("Cloning project…");
            try {
              const { cloneUserProject } = await import("@/lib/remixProject");
              const newId = await cloneUserProject(id);
              toast.success("Project cloned — no tokens used", { id: t });
              await refreshRecentProjects();
              navigate(`/build/${newId}`);
            } catch (e: any) {
              toast.error(e?.message || "Clone failed", { id: t });
            }
          }}
        />
      </section>

      </main>
      </div>
    </div>
    </>
  );

}

function MegsyLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="megsy-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A855F7" />
          <stop offset="0.5" stopColor="#EC4899" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path
        d="M12 21s-7.5-4.6-9.5-9.5C1 7.5 4 4 7.5 4c2 0 3.6 1.1 4.5 2.6C12.9 5.1 14.5 4 16.5 4c3.5 0 6.5 3.5 5 7.5C19.5 16.4 12 21 12 21z"
        fill="url(#megsy-grad)"
      />
    </svg>
  );
}

function PlusItem({ icon, label, onClick, hideArrow }: { icon: React.ReactNode; label: string; onClick: () => void; hideArrow?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-foreground/5 transition text-start"
    >
      <span className="text-foreground/70">{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      {!hideArrow && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

function Pill({ label, onRemove, icon }: { label: string; onRemove: () => void; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 max-w-[200px] h-7 px-2.5 rounded-full text-xs font-medium border border-foreground/10 bg-background/60">
      {icon}
      <span className="truncate">{label}</span>
      <button onClick={onRemove} className="opacity-50 hover:opacity-100">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ---------- Projects / Templates tabbed gallery ----------
type RecentProject = {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
  thumbnail_url: string | null;
  preview_url: string | null;
  published_url: string | null;
};

function mshotFor(url: string | null | undefined) {
  if (!url) return null;
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=800&h=500`;
}

function ProjectsTemplatesTabs({
  projects, projectsLoading, isPro,
  onOpenProject, onRemixProject,
}: {
  projects: RecentProject[];
  projectsLoading: boolean;
  isPro: boolean;
  onOpenProject: (id: string) => void;
  onRemixProject: (id: string) => void;
}) {
  const [tab, setTab] = useState<"mine" | "prompts">("mine");

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Header: stacked, breathable */}
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-6 px-1">
        <div className="space-y-1">
          <motion.h2
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-[26px] md:text-5xl font-bold text-foreground leading-tight tracking-tight"
          >
            {tab === "mine" ? "Your projects" : "Prompts"}
          </motion.h2>
          <p className="text-[12px] md:text-sm text-muted-foreground">
            {tab === "mine" ? "Pick up where you left off" : "Browse the most popular templates"}
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-foreground/10 bg-foreground/[0.04] p-1 self-start md:self-auto">
          <button
            onClick={() => setTab("mine")}
            className={`px-3.5 h-8 rounded-lg text-xs font-semibold transition ${
              tab === "mine" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Your projects
          </button>
          <button
            onClick={() => setTab("prompts")}
            className={`px-3.5 h-8 rounded-lg text-xs font-semibold transition ${
              tab === "prompts" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Prompts
          </button>
        </div>
      </div>

      {/* Active tab content */}
      {tab === "mine" && (
        projectsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 auto-rows-fr">
            {[0,1,2,3,4,5].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03] animate-pulse">
                <div className="aspect-[16/10] bg-foreground/[0.05]" />
                <div className="p-5 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-foreground/10" />
                  <div className="h-2 w-1/3 rounded bg-foreground/5" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No projects yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 auto-rows-fr">
            {projects.map((p, i) => {
              const liveUrl = p.published_url || p.preview_url;
              const shot = p.thumbnail_url || mshotFor(liveUrl);
              const featured = i === 0;
              return (
                <div
                  key={p.id}
                  className={`group relative overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03] hover:border-purple-500/50 transition-all duration-500 flex flex-col ${
                    featured ? "sm:col-span-2 md:col-span-2" : ""
                  }`}
                >
                  <button
                    onClick={() => onOpenProject(p.id)}
                    className="text-left w-full overflow-hidden aspect-[16/10] bg-gradient-to-br from-purple-500/20 via-foreground/[0.04] to-transparent relative"
                  >
                    {shot && (
                      <img
                        src={shot}
                        alt={p.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                  </button>

                  <div className="p-5 space-y-2 flex-1 flex flex-col">
                    {featured && (
                      <span className="inline-block w-fit px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-500 dark:text-purple-300 text-[10px] font-semibold">
                        Featured project
                      </span>
                    )}
                    <button onClick={() => onOpenProject(p.id)} className="text-left">
                      <h4 className={`font-medium text-foreground group-hover:text-purple-500 transition-colors truncate ${featured ? "text-lg md:text-xl" : "text-base"}`}>
                        {p.name || "Untitled"}
                      </h4>
                      <p className="text-muted-foreground text-xs italic">
                        Last modified {new Date(p.updated_at).toLocaleDateString()}
                      </p>
                    </button>
                    <div className="flex items-center gap-2 pt-1 mt-auto">
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenProject(p.id); }}
                        className="flex-1 h-8 rounded-lg bg-foreground/10 hover:bg-foreground/15 text-foreground text-xs font-semibold transition"
                      >
                        Open
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemixProject(p.id); }}
                        title="Clone this project — no AI tokens used"
                        className="flex-1 h-8 rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:opacity-90 transition"
                      >
                        <Sparkles className="h-3 w-3" /> Remix
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === "prompts" && <PromptsGallery />}
    </div>
  );
}





