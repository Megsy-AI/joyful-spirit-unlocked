// Workspaces list — Vercel/Geist aesthetic: sharp borders, mono numerals, neutral surface.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Lock, ArrowUpRight } from "lucide-react";
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
    <div className="space-y-8">
      {/* Header strip — Geist style: tiny meta + a stat */}
      <div className="flex items-end justify-between gap-6 flex-wrap pb-6 border-b border-border">
        <div className="space-y-1">
          <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground font-medium">Overview</p>
          <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-foreground">Workspaces</h2>
        </div>
        {workspaces.length > 0 && (
          <div className="flex items-center gap-6 text-right">
            <Stat label="Spaces" value={String(workspaces.length + 1)} />
            <div className="h-8 w-px bg-border" />
            <Stat label="Team credits" value={totalCredits.toFixed(0)} />
          </div>
        )}
      </div>

      {/* Rows — flat list, monospace ID-style numerals */}
      <div className="border border-border rounded-md divide-y divide-border bg-card overflow-hidden">
        <Row
          name="Personal"
          subtitle="Your private space"
          monogram="P"
          active={activeId === null}
          right={null}
          onSwitch={() => switchTo(null, "Personal")}
          onOpen={null}
        />

        {loading ? (
          <div className="px-4 py-6 grid place-items-center">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          workspaces.map((w) => (
            <Row
              key={w.id}
              name={w.name}
              subtitle={`${memberCounts[w.id] ?? 1} member${(memberCounts[w.id] ?? 1) === 1 ? "" : "s"} · Team`}
              monogram={w.name[0]?.toUpperCase() ?? "W"}
              avatarUrl={w.avatar_url}
              active={activeId === w.id}
              right={
                <span className={`font-mono text-[12px] tabular-nums ${Number(w.credits) < 50 ? "text-destructive" : "text-foreground"}`}>
                  {Number(w.credits).toFixed(0)}
                  <span className="text-muted-foreground/60 ml-1">cr</span>
                </span>
              }
              onSwitch={() => switchTo(w.id, w.name)}
              onOpen={() => navigate(`/settings/workspaces/${w.id}`)}
            />
          ))
        )}
      </div>

      {/* Create — Geist outlined CTA */}
      {canCreate ? (
        <button
          onClick={() => navigate("/settings/workspaces/new")}
          className="group w-full border border-dashed border-border rounded-md px-4 py-4 flex items-center gap-3 hover:border-foreground/40 hover:bg-foreground/[0.02] transition-colors text-left"
        >
          <div className="w-8 h-8 rounded border border-border grid place-items-center text-muted-foreground group-hover:text-foreground group-hover:border-foreground/40 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-foreground">Create workspace</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">Invite teammates and share credits.</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      ) : (
        <button
          onClick={() => navigate("/pricing")}
          className="group w-full border border-border rounded-md px-4 py-4 flex items-center gap-3 hover:border-foreground/40 transition-colors text-left bg-card"
        >
          <div className="w-8 h-8 rounded border border-border grid place-items-center text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium text-foreground">Create workspace</p>
              <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-px rounded-sm border border-border text-muted-foreground">
                Pro
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground mt-0.5">Upgrade your plan to unlock team workspaces.</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      )}
    </div>
  );

  if (!isMobile) {
    return (
      <DesktopSettingsLayout title="Workspaces" subtitle="Switch between personal and team spaces.">
        <div className="max-w-3xl">{body}</div>
      </DesktopSettingsLayout>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/settings")}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-[14px] font-medium text-foreground flex-1 tracking-tight">Workspaces</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 sm:px-6 py-8">{body}</main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">{label}</p>
      <p className="font-mono text-[18px] font-semibold tabular-nums tracking-tight text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function Row({
  name, subtitle, monogram, avatarUrl, active, right, onSwitch, onOpen,
}: {
  name: string;
  subtitle: string;
  monogram: string;
  avatarUrl?: string | null;
  active: boolean;
  right: React.ReactNode;
  onSwitch: () => void;
  onOpen: (() => void) | null;
}) {
  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-foreground/[0.015] transition-colors">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-9 h-9 rounded object-cover ring-1 ring-border shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded bg-foreground text-background grid place-items-center text-[13px] font-semibold shrink-0">
          {monogram}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13.5px] font-medium text-foreground truncate">{name}</p>
          {active && (
            <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-sm border border-border bg-background">
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
              <span className="text-[9.5px] uppercase tracking-wider font-mono text-muted-foreground">Active</span>
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">{subtitle}</p>
      </div>
      {right && <div className="hidden sm:block shrink-0 mr-1">{right}</div>}
      <div className="flex items-center gap-1 shrink-0">
        {onOpen && (
          <button
            onClick={onOpen}
            className="text-[11.5px] font-medium px-2 py-1 rounded border border-transparent text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            Manage
          </button>
        )}
        {!active && (
          <button
            onClick={onSwitch}
            className="text-[11.5px] font-medium px-2.5 py-1 rounded bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            Switch
          </button>
        )}
      </div>
    </div>
  );
}
