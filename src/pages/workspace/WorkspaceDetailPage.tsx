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
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/settings/workspaces")}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-muted-foreground/40 text-sm">/</span>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {(ctx.ws as any).avatar_url ? (
              <img src={(ctx.ws as any).avatar_url} alt="" className="w-7 h-7 rounded object-cover ring-1 ring-border" />
            ) : (
              <div className="w-7 h-7 rounded bg-foreground text-background grid place-items-center text-[11px] font-semibold">
                {ctx.ws.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex items-center gap-2">
              <h1 className="text-[13.5px] font-semibold text-foreground truncate tracking-tight">{ctx.ws.name}</h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-px rounded-sm border border-border">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                <span className="text-[9.5px] uppercase tracking-wider font-mono text-muted-foreground capitalize">{ctx.myRole || "member"}</span>
              </span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 mr-1 font-mono text-[11.5px] tabular-nums">
            <span className={lowCredits ? "text-destructive" : "text-foreground"}>{credits.toFixed(0)}</span>
            <span className="text-muted-foreground/60">cr</span>
            {lowCredits && <AlertTriangle className="w-3 h-3 text-destructive" />}
          </div>
          {ctx.canBilling && (
            <button
              onClick={() => navigate(`/settings/workspaces/${ctx.ws!.id}/billing`)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11.5px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3 h-3" /> Top up
            </button>
          )}
          <PresenceBar workspaceId={ctx.ws.id} />
          <button
            onClick={() => setNavOpen((v) => !v)}
            className="md:hidden p-1.5 rounded-md hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>


      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-10 lg:gap-14 animate-fade-in">
        <aside className={`${navOpen ? "block" : "hidden"} md:block`}>
          <div onClick={() => setNavOpen(false)} className="md:sticky md:top-20">
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
