// Workspaces list — richer card grid with credits meter, members, and quick actions.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Sparkles, Lock, Users, Crown, Settings2, ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaces } from "@/hooks/useWorkspace";
import { useIsMobile } from "@/hooks/use-mobile";
import { DesktopSettingsLayout } from "@/components/settings/DesktopSettingsLayout";
import { useUserPlan } from "@/hooks/useUserPlan";

const PRO_PLANS = new Set(["pro", "elite", "business", "enterprise"]);

export default function WorkspacesPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { workspaces, activeId, setActive, loading } = useWorkspaces();
  const { plan } = useUserPlan();
  const canCreate = PRO_PLANS.has(plan);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!workspaces.length) return;
    (async () => {
      const ids = workspaces.map((w) => w.id);
      const { data } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .in("workspace_id", ids);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        counts[r.workspace_id] = (counts[r.workspace_id] ?? 0) + 1;
      });
      setMemberCounts(counts);
    })();
  }, [workspaces]);

  const switchTo = async (id: string | null, name: string) => {
    await setActive(id);
    toast.success(`Switched to ${name}`);
  };

  const totalCredits = workspaces.reduce((sum, w) => sum + Number(w.credits ?? 0), 0);

  const body = (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="space-y-2 max-w-xl">
          <h2 className="text-[28px] font-semibold tracking-tight text-foreground">Your workspaces</h2>
          <p className="text-[14px] text-muted-foreground">
            Switch between personal and team spaces. Each workspace has its own credits, members, and billing.
          </p>
        </div>
        {workspaces.length > 0 && (
          <div className="rounded-xl border border-border bg-card px-4 py-3 min-w-[180px]">
            <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-medium">Team credits</p>
            <p className="text-[20px] font-semibold tabular-nums tracking-tight mt-0.5">{totalCredits.toFixed(0)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">across {workspaces.length} space{workspaces.length === 1 ? "" : "s"}</p>
          </div>
        )}
      </div>

      {/* Personal — always one card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PersonalCard active={activeId === null} onSwitch={() => switchTo(null, "Personal")} />

        {loading ? (
          <div className="rounded-2xl border border-border bg-card grid place-items-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          workspaces.map((w) => (
            <WorkspaceCard
              key={w.id}
              name={w.name}
              credits={Number(w.credits ?? 0)}
              avatarUrl={w.avatar_url}
              members={memberCounts[w.id] ?? 1}
              active={activeId === w.id}
              onSwitch={() => switchTo(w.id, w.name)}
              onOpen={() => navigate(`/settings/workspaces/${w.id}`)}
            />
          ))
        )}

        {/* Create card lives inside the grid for a clean rhythm */}
        {canCreate ? (
          <button
            onClick={() => navigate("/settings/workspaces/new")}
            className="group rounded-2xl border border-dashed border-border hover:border-foreground/40 hover:bg-foreground/[0.02] transition-all duration-200 p-5 text-left flex flex-col gap-3 min-h-[148px] justify-center"
          >
            <div className="w-10 h-10 rounded-xl border border-dashed border-border grid place-items-center text-muted-foreground group-hover:text-foreground group-hover:border-foreground/40 transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-foreground">Create workspace</p>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">Invite teammates and share credits.</p>
            </div>
          </button>
        ) : (
          <button
            onClick={() => navigate("/pricing")}
            className="group rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] via-card to-card hover:border-primary/50 transition-all duration-200 p-5 text-left flex flex-col gap-3 min-h-[148px] justify-center relative overflow-hidden"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 grid place-items-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-medium text-foreground">Create workspace</p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                  <Lock className="w-2.5 h-2.5" /> PRO
                </span>
              </div>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">Upgrade to unlock team workspaces.</p>
            </div>
            <span className="text-[12.5px] font-medium text-primary inline-flex items-center gap-1 mt-1">Upgrade <ArrowRight className="w-3 h-3" /></span>
          </button>
        )}
      </div>
    </div>
  );

  if (!isMobile) {
    return (
      <DesktopSettingsLayout title="Workspaces" subtitle="Switch between personal and team spaces.">
        <div className="max-w-4xl">{body}</div>
      </DesktopSettingsLayout>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate("/settings")}
            className="p-2 -ml-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[15px] font-medium text-foreground flex-1">Workspaces</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 sm:px-8 py-10">{body}</main>
    </div>
  );
}

function PersonalCard({ active, onSwitch }: { active: boolean; onSwitch: () => void }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={`relative rounded-2xl border bg-card p-5 transition-colors ${
        active ? "border-primary/40 ring-1 ring-primary/20" : "border-border hover:border-foreground/20"
      }`}
    >
      {active && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
          <Check className="w-2.5 h-2.5" /> Current
        </span>
      )}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-foreground to-foreground/70 text-background grid place-items-center text-[15px] font-semibold shrink-0">
          P
        </div>
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold text-foreground truncate">Personal</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">Your private space</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end">
        {!active && (
          <button
            onClick={onSwitch}
            className="text-[12.5px] font-medium px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            Switch
          </button>
        )}
      </div>
    </motion.div>
  );
}

function WorkspaceCard({
  name, credits, avatarUrl, members, active, onSwitch, onOpen,
}: {
  name: string;
  credits: number;
  avatarUrl?: string | null;
  members: number;
  active: boolean;
  onSwitch: () => void;
  onOpen: () => void;
}) {
  // Visual credits meter: cap at 1000 for the bar, then it just stays full.
  const pct = Math.min(100, (credits / 1000) * 100);
  const low = credits < 50;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={`relative rounded-2xl border bg-card p-5 transition-colors ${
        active ? "border-primary/40 ring-1 ring-primary/20" : "border-border hover:border-foreground/20"
      }`}
    >
      {active && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
          <Check className="w-2.5 h-2.5" /> Current
        </span>
      )}
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 ring-1 ring-border" />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground grid place-items-center text-[15px] font-semibold shrink-0">
            {name[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold text-foreground truncate">{name}</p>
          <p className="text-[12px] text-muted-foreground mt-0.5 flex items-center gap-2">
            <Users className="w-3 h-3" />
            <span className="tabular-nums">{members}</span>
            <span className="text-muted-foreground/40">·</span>
            <Crown className="w-3 h-3" />
            <span>Team</span>
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-medium">Credits</span>
          <span className={`text-[12px] font-semibold tabular-nums ${low ? "text-destructive" : "text-foreground"}`}>
            {credits.toFixed(0)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${low ? "bg-destructive" : "bg-foreground"}`}
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-1">
        <button
          onClick={onOpen}
          className="text-[12.5px] font-medium px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors inline-flex items-center gap-1.5"
          aria-label={`${name} settings`}
        >
          <Settings2 className="w-3.5 h-3.5" /> Manage
        </button>
        {!active && (
          <button
            onClick={onSwitch}
            className="text-[12.5px] font-medium px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            Switch
          </button>
        )}
      </div>
    </motion.div>
  );
}
