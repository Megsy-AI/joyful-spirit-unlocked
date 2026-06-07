// Workspace detail layout — Notion-style spacious settings.
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Loader2, Menu, Plus, AlertTriangle } from "lucide-react";
import { useWorkspaceContext } from "@/hooks/useWorkspaceContext";
import WorkspaceSideNav from "@/components/workspace/WorkspaceSideNav";
import PresenceBar from "@/components/workspace/PresenceBar";


export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ctx = useWorkspaceContext(id);
  const [navOpen, setNavOpen] = useState(false);

  if (ctx.loading || !ctx.ws) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const credits = Number(ctx.ws.credits ?? 0);
  const lowCredits = credits < 50;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/75 backdrop-blur-xl border-b border-border/60">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 h-16 flex items-center gap-4">
          <button
            onClick={() => navigate("/settings/workspaces")}
            className="p-2 -ml-2 rounded-lg hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {(ctx.ws as any).avatar_url ? (
              <img src={(ctx.ws as any).avatar_url} alt="" className="w-9 h-9 rounded-xl object-cover ring-1 ring-border/60" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground grid place-items-center text-[13px] font-semibold shadow-sm">
                {ctx.ws.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-[14.5px] font-semibold text-foreground truncate leading-tight tracking-tight">{ctx.ws.name}</h1>
              <p className="text-[11.5px] text-muted-foreground capitalize leading-tight mt-0.5 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                  {ctx.myRole || "member"}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className={`tabular-nums ${lowCredits ? "text-destructive font-medium" : ""}`}>{credits.toFixed(0)} credits</span>
                {lowCredits && <AlertTriangle className="w-3 h-3 text-destructive" />}
              </p>
            </div>
          </div>
          {ctx.canBilling && (
            <button
              onClick={() => navigate(`/settings/workspaces/${ctx.ws!.id}/billing`)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" /> Top up
            </button>
          )}
          <PresenceBar workspaceId={ctx.ws.id} />
          <button
            onClick={() => setNavOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>


      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-12 grid grid-cols-1 md:grid-cols-[232px_1fr] gap-10 lg:gap-14 animate-fade-in">
        <aside className={`${navOpen ? "block" : "hidden"} md:block`}>
          <div onClick={() => setNavOpen(false)} className="md:sticky md:top-24">
            <WorkspaceSideNav />
          </div>
        </aside>
        <main className="min-w-0 max-w-3xl">
          <Outlet context={{ ws: ctx.ws, me: ctx.me, myRole: ctx.myRole, isOwner: ctx.isOwner, isAdmin: ctx.isAdmin, canBilling: ctx.canBilling }} />
        </main>
      </div>
    </div>
  );
}
