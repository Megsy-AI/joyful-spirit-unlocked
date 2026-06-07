// Account switcher — Vercel/Geist style: flat rows, mono numerals, sharp corners.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Users, Settings2, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspaces } from "@/hooks/useWorkspace";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { toast } from "sonner";

interface Props {
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

export default function WorkspaceSwitcher({ children, align = "start", side = "top" }: Props) {
  const navigate = useNavigate();
  const { workspaces, activeId, setActive, loading } = useWorkspaces();
  const account = useActiveAccount();
  const [open, setOpen] = useState(false);

  const switchTo = async (id: string | null, name: string) => {
    await setActive(id);
    toast.success(`Switched to ${name}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} side={side} className="w-72 p-0 rounded-md border-border shadow-lg">
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Active</p>
            <p className="text-[13px] font-semibold text-foreground truncate tracking-tight">{account.name}</p>
          </div>
          <p className="font-mono text-[11px] tabular-nums text-muted-foreground shrink-0">
            <span className="text-foreground">{account.credits.toFixed(0)}</span>
            <span className="ml-1 text-muted-foreground/60">cr</span>
          </p>
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
          <button
            onClick={() => switchTo(null, "Personal")}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted text-left"
          >
            <div className="w-7 h-7 rounded bg-muted grid place-items-center text-[11px] font-semibold text-foreground">P</div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-foreground truncate">Personal</p>
              <p className="text-[10.5px] text-muted-foreground">Your private space</p>
            </div>
            {activeId === null && <Check className="w-3.5 h-3.5 text-foreground" />}
          </button>

          {loading ? (
            <p className="px-3 py-2 text-[11px] text-muted-foreground">Loading…</p>
          ) : (
            workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => switchTo(w.id, w.name)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted text-left"
              >
                {w.avatar_url ? (
                  <img src={w.avatar_url} alt="" className="w-7 h-7 rounded object-cover ring-1 ring-border" />
                ) : (
                  <div className="w-7 h-7 rounded bg-foreground text-background grid place-items-center text-[11px] font-semibold">
                    {w.name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium text-foreground truncate">{w.name}</p>
                  <p className="font-mono text-[10.5px] text-muted-foreground tabular-nums">{Number(w.credits).toFixed(0)} cr</p>
                </div>
                {activeId === w.id && <Check className="w-3.5 h-3.5 text-foreground" />}
              </button>
            ))
          )}
        </div>

        <div className="border-t border-border py-1">
          {activeId && (
            <button
              onClick={() => { setOpen(false); navigate(`/settings/workspaces/${activeId}`); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12.5px] text-foreground hover:bg-muted text-left"
            >
              <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
              Manage current workspace
            </button>
          )}
          <button
            onClick={() => { setOpen(false); navigate("/settings/workspaces"); }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12.5px] text-foreground hover:bg-muted text-left"
          >
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            All workspaces
          </button>
          <button
            onClick={() => { setOpen(false); navigate("/settings/workspaces/new"); }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12.5px] text-foreground hover:bg-muted text-left"
          >
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            New workspace
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
