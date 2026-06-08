import {
  Bell,
  CreditCard,
  Settings,
  Sparkles,
  Users,
  CheckCheck,
  UserPlus,
  Check,
  X,
  UserCheck,
  UserX,
  Loader2,
  Inbox,
} from "lucide-react";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface InviteRpcResult {
  success?: boolean;
  error?: string;
  workspace_id?: string;
}

const typeConfig: Record<string, { icon: typeof Bell; className: string }> = {
  credits: { icon: CreditCard, className: "text-yellow-500" },
  system: { icon: Settings, className: "text-blue-500" },
  generation: { icon: Sparkles, className: "text-purple-500" },
  referral: { icon: Users, className: "text-green-500" },
  workspace_invite: { icon: UserPlus, className: "text-indigo-500" },
  workspace_invite_accepted: { icon: UserCheck, className: "text-emerald-500" },
  workspace_invite_declined: { icon: UserX, className: "text-rose-500" },
};

const NotificationBell = () => {
  const { notifications, unreadCount, loading, markAllRead, markOneRead } =
    useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Record<string, "accept" | "decline" | undefined>>({});
  const [handled, setHandled] = useState<Record<string, "accepted" | "declined" | undefined>>({});

  const handleInvite = async (n: Notification, action: "accept" | "decline") => {
    const rawToken = n.metadata.invite_token;
    const token = typeof rawToken === "string" ? rawToken : undefined;
    if (!token) {
      toast.error("Invite link is missing");
      return;
    }
    setPending((p) => ({ ...p, [n.id]: action }));
    try {
      const rpc = action === "accept" ? "workspace_accept_invite" : "workspace_decline_invite";
      const { data, error } = await supabase.rpc(rpc, { p_token: token });
      if (error) throw error;
      const result = (data && typeof data === "object" && !Array.isArray(data)
        ? data
        : {}) as InviteRpcResult;
      if (!result?.success) {
        const msg: Record<string, string> = {
          not_found: "Invite no longer exists",
          already_used: "This invite was already used",
          expired: "This invite has expired",
          email_mismatch: "Invite is for a different email",
          auth_required: "Please sign in first",
        };
        throw new Error(msg[result?.error] || "Could not process invite");
      }
      setHandled((h) => ({ ...h, [n.id]: action === "accept" ? "accepted" : "declined" }));
      markOneRead(n.id);
      if (action === "accept") {
        toast.success("You joined the workspace");
        if (result.workspace_id) navigate(`/workspaces/${result.workspace_id}`);
      } else {
        toast.success("Invite declined");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending((p) => ({ ...p, [n.id]: undefined }));
    }
  };

  const renderItem = (n: Notification) => {
    const config = typeConfig[n.type] || typeConfig.system;
    const Icon = config.icon;
    const isInvite = n.type === "workspace_invite";
    const inviteState = handled[n.id];
    const inFlight = pending[n.id];
    return (
      <div
        key={n.id}
        className={cn(
          "w-full rounded-xl px-3 py-3 transition-colors",
          !n.read ? "bg-accent/35" : "hover:bg-accent/20",
          n.read && !isInvite && "opacity-70"
        )}
      >
        <button
          onClick={() => { if (!isInvite) markOneRead(n.id); }}
          className="w-full text-left flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Icon className={`w-4 h-4 ${config.className}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">{n.title}</p>
            <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">{n.message}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
            </p>
          </div>
          {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
        </button>

        {isInvite && (
          <div className="mt-3 pl-11">
            {inviteState === "accepted" ? (
              <div className="text-xs font-medium text-emerald-500 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Joined
              </div>
            ) : inviteState === "declined" ? (
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" /> Declined
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  disabled={!!inFlight}
                  onClick={() => handleInvite(n, "accept")}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {inFlight === "accept" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Accept
                </button>
                <button
                  disabled={!!inFlight}
                  onClick={() => handleInvite(n, "decline")}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-foreground text-xs font-medium hover:bg-accent/50 transition disabled:opacity-50"
                >
                  {inFlight === "decline" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  Decline
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors w-9 h-9"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-[min(360px,calc(100vw-24px))] rounded-2xl border-border/70 bg-popover/95 p-0 shadow-[0_24px_70px_-32px_hsl(var(--foreground)/0.35)] backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/70">
          <div>
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <p className="text-[11px] text-muted-foreground">{unreadCount ? `${unreadCount} unread` : "All caught up"}</p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-2.5 py-1.5 hover:bg-accent/40 transition"
            >
              <CheckCheck className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
        <ScrollArea className="max-h-[min(430px,65vh)]">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-8 py-12 text-center">
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
                <Inbox className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium text-foreground">No notifications</p>
              <p className="mt-1 text-xs text-muted-foreground">New updates will appear here quietly.</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {notifications.slice(0, 12).map(renderItem)}
            </div>
          )}
        </ScrollArea>
        <div className="border-t border-border/70 px-4 py-3">
          <button
            onClick={() => { setOpen(false); navigate("/settings/notifications"); }}
            className="text-xs text-muted-foreground hover:text-foreground w-full text-center transition-colors"
          >
            Notification settings
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
