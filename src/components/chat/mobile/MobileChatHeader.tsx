import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Copy, Globe, Loader2, Lock, MoreVertical, Plus, Share2, UserPlus, Pencil, Pin, Trash2 } from "lucide-react";

type MenuView = "main" | "rename" | "invite" | "share" | "delete";

export interface MobileChatHeaderProps {
  title?: string;
  hasConversation: boolean;
  isPinned?: boolean;
  onOpenSidebar: () => void;
  onNewChat: () => void;
  onShare: () => void;
  onInvite: () => void;
  onRename: () => void;
  onTogglePin: () => void;
  onDelete: () => void | Promise<void>;
  isDeleting?: boolean;
  rightSlot?: React.ReactNode;

  // Inline view props (optional — when present, Share/Invite/Rename open inside the same menu)
  inlineRename?: {
    value: string;
    onChange: (v: string) => void;
    onSave: () => void;
  };
  inlineInvite?: {
    email: string;
    onEmailChange: (v: string) => void;
    onSend: () => void;
    loading?: boolean;
    link?: string | null;
    onCopyLink: () => void;
    onOpen: () => void;
  };
  inlineShare?: {
    mode: "private" | "public";
    onModeChange: (m: "private" | "public") => void;
    url?: string | null;
    onCopyLink: () => void;
    onOpen: () => void;
  };
}

export default function MobileChatHeader({
  hasConversation,
  isPinned,
  onOpenSidebar,
  onNewChat,
  onShare,
  onInvite,
  onRename,
  onTogglePin,
  onDelete,
  isDeleting,
  rightSlot,
  inlineRename,
  inlineInvite,
  inlineShare,
}: MobileChatHeaderProps) {
  const [open, setOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>("main");

  const close = () => { setOpen(false); setMenuView("main"); };
  const runAndClose = (fn: () => void) => { setOpen(false); setMenuView("main"); setTimeout(fn, 60); };

  const goRename = () => {
    if (inlineRename) { onRename(); setMenuView("rename"); }
    else runAndClose(onRename);
  };
  const goInvite = () => {
    if (inlineInvite) { inlineInvite.onOpen(); setMenuView("invite"); }
    else runAndClose(onInvite);
  };
  const goShare = () => {
    if (inlineShare) { inlineShare.onOpen(); setMenuView("share"); }
    else runAndClose(onShare);
  };

  const items: Array<{ icon: typeof Share2; label: string; onClick: () => void }> = [
    { icon: Share2, label: "Share", onClick: goShare },
    { icon: Pin, label: isPinned ? "Unpin" : "Pin chat", onClick: () => runAndClose(onTogglePin) },
    { icon: UserPlus, label: "Invite people", onClick: goInvite },
    { icon: Pencil, label: "Rename", onClick: goRename },
    { icon: Plus, label: "New chat", onClick: () => runAndClose(onNewChat) },
  ];

  const confirmDelete = async () => {
    await onDelete();
    close();
  };

  return (
    <>
      <div
        data-testid="mobile-chat-header"
        className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center gap-2 px-3 py-1.5 min-h-[44px] pt-[max(env(safe-area-inset-top),0.25rem)] bg-transparent pointer-events-none [&>*]:pointer-events-auto"
      >
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          data-testid="mobile-open-sidebar"
          className="ios-fab w-11 h-11 rounded-full flex items-center justify-center text-foreground"
        >
          <ChevronRight className="mobile-header-icon-black w-[22px] h-[22px]" strokeWidth={2.25} />
        </button>

        <div className="flex-1 min-w-0 text-center">
          {!hasConversation ? rightSlot ?? null : null}
        </div>

        {hasConversation ? (
          <button
            type="button"
            aria-label="More options"
            data-testid="mobile-more-menu"
            onClick={() => { setMenuView("main"); setOpen(true); }}
            className="ios-fab w-10 h-10 rounded-full flex items-center justify-center text-foreground"
          >
            <MoreVertical className="mobile-header-icon-black w-5 h-5" />
          </button>
        ) : (
          <span className="w-10 h-10 opacity-0 pointer-events-none" aria-hidden />
        )}
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="lg-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="md:hidden fixed inset-0 z-40"
              onClick={() => { if (!isDeleting) close(); }}
            />

            <motion.div
              key="lg-menu"
              data-testid="mobile-more-menu-content"
              initial={{ opacity: 0, scale: 0.94, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.7 }}
              style={{
                top: "calc(env(safe-area-inset-top, 0px) + 52px)",
                transformOrigin: "top right",
                background:
                  "linear-gradient(180deg, hsl(var(--background) / 0.55), hsl(var(--background) / 0.72))",
                backdropFilter: "blur(28px) saturate(180%)",
                WebkitBackdropFilter: "blur(28px) saturate(180%)",
                boxShadow:
                  "0 22px 48px -16px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 hsl(var(--foreground) / 0.08), inset 0 0 0 0.5px hsl(var(--foreground) / 0.10)",
              }}
              className="md:hidden fixed right-3 z-50 w-[280px] rounded-[22px] overflow-hidden border border-foreground/10"
              dir="rtl"
            >
              <AnimatePresence mode="wait" initial={false}>
                {menuView === "main" && (
                  <motion.div
                    key="menu-main"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.14 }}
                    className="py-1"
                  >
                    {items.map(({ icon: Icon, label, onClick }, i) => (
                      <div key={label}>
                        {i !== 0 && <div className="h-px bg-foreground/[0.07] mx-3" />}
                        <button
                          type="button"
                          onClick={onClick}
                          data-testid={`mobile-menu-${label.toLowerCase().replace(/\s+/g, "-")}`}
                          className="w-full flex items-center gap-3 px-4 py-3 transition-colors active:bg-foreground/[0.08] text-foreground"
                        >
                          <span className="flex-1 truncate text-[15px] font-medium text-right">{label}</span>
                          <Icon className="w-[19px] h-[19px] text-foreground shrink-0" strokeWidth={1.8} />
                        </button>
                      </div>
                    ))}
                    <div className="h-px bg-foreground/[0.07] mx-3" />
                    <button
                      type="button"
                      onClick={() => setMenuView("delete")}
                      data-testid="mobile-menu-delete"
                      className="w-full flex items-center gap-3 px-4 py-3 transition-colors active:bg-destructive/10 text-destructive"
                    >
                      <span className="flex-1 truncate text-[15px] font-medium text-right">Delete</span>
                      <Trash2 className="w-[19px] h-[19px] shrink-0" strokeWidth={1.8} />
                    </button>
                  </motion.div>
                )}

                {menuView === "rename" && inlineRename && (
                  <motion.div
                    key="menu-rename"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.14 }}
                    className="p-3"
                  >
                    <BackButton onClick={() => setMenuView("main")} />
                    <div className="px-1 pb-2 text-right text-[14px] font-semibold text-foreground">Rename chat</div>
                    <input
                      autoFocus
                      dir="auto"
                      value={inlineRename.value}
                      onChange={(e) => inlineRename.onChange(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { inlineRename.onSave(); close(); } }}
                      className="w-full h-10 rounded-xl bg-foreground/[0.06] border border-foreground/10 px-3 text-[14px] text-foreground outline-none focus:border-foreground/25"
                    />
                    <div className="flex items-center gap-2 mt-3">
                      <button type="button" onClick={() => setMenuView("main")} className="flex-1 rounded-xl px-3 py-2 text-[12px] font-semibold text-muted-foreground active:bg-foreground/[0.08]">Cancel</button>
                      <button type="button" onClick={() => { inlineRename.onSave(); close(); }} className="flex-1 rounded-xl px-3 py-2 text-[12px] font-semibold bg-primary text-primary-foreground active:opacity-90">Save</button>
                    </div>
                  </motion.div>
                )}

                {menuView === "invite" && inlineInvite && (
                  <motion.div
                    key="menu-invite"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.14 }}
                    className="p-3"
                  >
                    <BackButton onClick={() => setMenuView("main")} />
                    <div className="px-1 pb-1 text-right text-[14px] font-semibold text-foreground">Invite people</div>
                    <p className="px-1 pb-2 text-right text-[11px] text-muted-foreground">Add someone to this chat</p>
                    <div className="flex items-center gap-2">
                      <input
                        dir="ltr"
                        value={inlineInvite.email}
                        onChange={(e) => inlineInvite.onEmailChange(e.target.value)}
                        placeholder="friend@example.com"
                        onKeyDown={(e) => { if (e.key === "Enter") inlineInvite.onSend(); }}
                        className="flex-1 h-9 rounded-xl bg-foreground/[0.06] border border-foreground/10 px-3 text-[13px] text-foreground outline-none focus:border-foreground/25"
                      />
                      <button
                        type="button"
                        onClick={inlineInvite.onSend}
                        disabled={inlineInvite.loading || !inlineInvite.email.trim()}
                        className="h-9 px-3 rounded-xl text-[12px] font-semibold bg-foreground text-background active:opacity-90 disabled:opacity-40"
                      >
                        {inlineInvite.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Invite"}
                      </button>
                    </div>
                    {inlineInvite.link ? (
                      <button
                        type="button"
                        onClick={inlineInvite.onCopyLink}
                        className="mt-2 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-foreground/[0.06] active:bg-foreground/[0.10]"
                      >
                        <span className="text-[11px] text-foreground truncate" dir="ltr">{inlineInvite.link}</span>
                        <Copy className="w-3.5 h-3.5 text-foreground shrink-0" />
                      </button>
                    ) : (
                      <p className="mt-2 text-center text-[11px] text-muted-foreground">Generating link…</p>
                    )}
                  </motion.div>
                )}

                {menuView === "share" && inlineShare && (
                  <motion.div
                    key="menu-share"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.14 }}
                    className="p-3"
                  >
                    <BackButton onClick={() => setMenuView("main")} />
                    <div className="px-1 pb-1 text-right text-[14px] font-semibold text-foreground">Share chat</div>
                    <p className="px-1 pb-2 text-right text-[11px] text-muted-foreground">Future messages aren't included</p>
                    <div className="rounded-xl border border-foreground/10 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => inlineShare.onModeChange("private")}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 ${inlineShare.mode === "private" ? "bg-foreground/[0.10]" : "active:bg-foreground/[0.06]"}`}
                      >
                        <Lock className="w-3.5 h-3.5 text-foreground shrink-0" />
                        <div className="text-right flex-1 min-w-0">
                          <p className="text-[12.5px] font-semibold text-foreground">Keep private</p>
                          <p className="text-[10.5px] text-muted-foreground">Only you have access</p>
                        </div>
                      </button>
                      <div className="h-px bg-foreground/10" />
                      <button
                        type="button"
                        onClick={() => inlineShare.onModeChange("public")}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 ${inlineShare.mode === "public" ? "bg-foreground/[0.10]" : "active:bg-foreground/[0.06]"}`}
                      >
                        <Globe className="w-3.5 h-3.5 text-foreground shrink-0" />
                        <div className="text-right flex-1 min-w-0">
                          <p className="text-[12.5px] font-semibold text-foreground">Create public link</p>
                          <p className="text-[10.5px] text-muted-foreground">Anyone with the link can view</p>
                        </div>
                      </button>
                    </div>
                    {inlineShare.mode === "public" && (
                      <div className="mt-3">
                        {inlineShare.url ? (
                          <button
                            type="button"
                            onClick={inlineShare.onCopyLink}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-foreground/[0.06] active:bg-foreground/[0.10]"
                          >
                            <span className="text-[11px] text-foreground truncate" dir="ltr">{inlineShare.url}</span>
                            <Copy className="w-3.5 h-3.5 text-foreground shrink-0" />
                          </button>
                        ) : (
                          <p className="text-center text-[11px] text-muted-foreground py-1">Generating link…</p>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {menuView === "delete" && (
                  <motion.div
                    key="menu-delete"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.14 }}
                    className="p-3"
                  >
                    <BackButton onClick={() => setMenuView("main")} disabled={isDeleting} />
                    <div className="px-1 pb-3 text-right">
                      <div className="text-[14px] font-semibold text-foreground">Delete chat?</div>
                      <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">This conversation will be permanently removed.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMenuView("main")}
                        disabled={isDeleting}
                        className="flex-1 rounded-xl px-3 py-2 text-[12px] font-semibold text-muted-foreground transition-colors active:bg-foreground/[0.08] disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirmDelete}
                        disabled={isDeleting}
                        className="flex-1 rounded-xl px-3 py-2 text-[12px] font-semibold bg-destructive text-destructive-foreground transition-opacity active:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Delete
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mb-2 flex items-center gap-1 text-[12px] font-medium text-muted-foreground active:text-foreground disabled:opacity-50"
    >
      <ChevronRight className="w-3.5 h-3.5 rotate-180" />
      Back
    </button>
  );
}
