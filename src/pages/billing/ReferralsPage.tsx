import { ArrowLeft, Copy, Check, X, QrCode, Sparkles, TrendingUp, Users, DollarSign, Wallet, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { DesktopSettingsLayout } from "@/components/settings/DesktopSettingsLayout";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import LiveAurora from "@/components/referral/LiveAurora";

interface Referral { id: string; referred_id: string; status: string; created_at: string; }
interface Earning { id: string; amount: number; source_action: string; created_at: string; }
interface Withdrawal { id: string; amount: number; status: string; method: string; created_at: string; }

interface Stats {
  totalClicks: number;
  conversions: number;
  convRate: number;
  totalEarned: number;
  availableEarnings: number;
  pendingEarnings: number;
  signups: number;
  topSources: { source: string; clicks: number; conversions: number }[];
  topCountries: { country: string; count: number }[];
  peakHour: number;
  streak: number;
  bestDay: { date: string; clicks: number };
  milestones: { milestone_key: string; achieved_at: string }[];
}

interface Tier { tier_name: string; commission_rate: number; }

interface ShareData {
  url: string;
  qr_url: string;
  share: Record<string, string>;
}

const MILESTONE_LABELS: Record<string, string> = {
  first_referral: "First Referral",
  ten_referrals: "10 Referrals",
  first_10_dollars: "First $10",
  first_100_dollars: "First $100",
  week_streak: "7-Day Streak",
};

/* ----- iOS 26 Liquid Glass primitives ----- */

const Glass = ({
  children,
  className = "",
  as: As = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  [k: string]: unknown;
}) => (
  <As
    className={
      "relative rounded-[26px] border border-white/12 bg-white/[0.06] " +
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_30px_60px_-30px_rgba(0,0,0,0.6)] " +
      "backdrop-blur-2xl backdrop-saturate-150 " +
      className
    }
    {...rest}
  >
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[26px] opacity-70"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 35%, rgba(255,255,255,0) 65%, rgba(255,255,255,0.04) 100%)",
      }}
    />
    <div className="relative">{children}</div>
  </As>
);

const GlassPill = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span
    className={
      "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur-xl " +
      className
    }
  >
    {children}
  </span>
);

/* ----------------------------------------- */

const ReferralsPage = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [copiedLanding, setCopiedLanding] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [activeTab, setActiveTab] = useState<"insights" | "referrals" | "earnings" | "withdrawals">("insights");

  const referralLink = referralCode ? `${window.location.origin}/ref/${referralCode}` : "";
  const landingLink = referralCode ? `${window.location.origin}/r/${referralCode}` : "";

  const shareTemplates = referralCode
    ? [
        { id: "casual", label: "Casual", text: `Hey! I've been using Megsy AI — it's actually amazing. Chat, image, video, code, all in one place. Try it free: ${landingLink}` },
        { id: "value", label: "Value", text: `Stop paying for 5 different AI tools. Megsy AI = ChatGPT + Midjourney + Runway + Cursor in ONE app. Start free → ${landingLink}` },
        { id: "creator", label: "Creator", text: `My new favorite AI tool 🤖✨\n\nText, images, videos, code — all from one prompt.\nGrab it free here: ${landingLink}` },
      ]
    : [];

  const callApi = useCallback(async (op: string, body: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("referral-track", { body: { op, ...body } });
    if (error) throw error;
    return data;
  }, []);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: codes } = await supabase
      .from("referral_codes").select("code").eq("user_id", user.id).limit(1);
    let code = codes?.[0]?.code;
    if (!code) {
      code = `MEGSY-${user.id.substring(0, 6).toUpperCase()}`;
      await supabase.from("referral_codes").insert({ user_id: user.id, code });
    }
    setReferralCode(code);

    const [refsRes, earnsRes, wdsRes] = await Promise.all([
      supabase.from("referrals").select("*").eq("referrer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("referral_earnings").select("*").eq("referrer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("withdrawal_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setReferrals(refsRes.data || []);
    setEarnings(earnsRes.data || []);
    setWithdrawals(wdsRes.data || []);

    try {
      const [statsData, tierData, shareRes] = await Promise.all([
        callApi("stats"),
        callApi("tier"),
        callApi("share", { origin: window.location.origin }),
      ]);
      setStats(statsData);
      setTier(tierData);
      setShareData(shareRes);
    } catch (e) {
      console.warn("referral-api unavailable", e);
    }
  }, [callApi]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Tracking link copied");
    setTimeout(() => setCopied(false), 1800);
  };
  const handleCopyLanding = () => {
    navigator.clipboard.writeText(landingLink);
    setCopiedLanding(true);
    toast.success("Landing link copied");
    setTimeout(() => setCopiedLanding(false), 1800);
  };
  const handleCopyTemplate = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessage(id);
    toast.success("Message copied");
    setTimeout(() => setCopiedMessage(null), 1800);
  };
  const handleShare = (platform: string) => {
    if (!shareData?.share[platform]) return;
    window.open(shareData.share[platform], "_blank", "noopener,noreferrer");
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const totalEarned = stats?.totalEarned ?? earnings.reduce((s, e) => s + Number(e.amount), 0);
  const availableBalance = stats?.availableEarnings ?? 0;
  const commissionPct = tier ? Math.round(tier.commission_rate * 100) : 15;
  const tierName = tier?.tier_name ?? "Bronze";

  /* ---------- shared building blocks ---------- */

  const heroBlock = (
    <Glass className="overflow-hidden p-6 md:p-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-4">
          <GlassPill>
            <Sparkles className="h-3 w-3" /> {tierName} · {commissionPct}% Lifetime
          </GlassPill>
          <h1 className="text-[34px] md:text-[52px] font-semibold leading-[1.05] tracking-[-0.02em] text-white">
            Invite friends.<br />
            <span className="bg-gradient-to-r from-white via-white/80 to-white/50 bg-clip-text text-transparent">
              Earn forever.
            </span>
          </h1>
          <p className="max-w-md text-[14px] leading-relaxed text-white/65">
            Every paying referral pays you {commissionPct}% — every month, for as long as they stay.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 md:items-end">
          <div className="rounded-3xl border border-white/15 bg-white/[0.08] p-5 backdrop-blur-xl">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/55">Available balance</p>
            <p className="mt-1 text-[44px] font-semibold leading-none tracking-tight text-white">
              ${availableBalance.toFixed(2)}
            </p>
            {stats && stats.pendingEarnings > 0 && (
              <p className="mt-1 text-[11px] text-white/45">${stats.pendingEarnings.toFixed(2)} pending</p>
            )}
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/settings/withdraw")}
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-[14px] font-semibold text-black shadow-[0_10px_30px_-10px_rgba(255,255,255,0.6)] transition-all hover:shadow-[0_14px_40px_-12px_rgba(255,255,255,0.8)]"
          >
            <Wallet className="h-4 w-4" />
            Withdraw earnings
          </motion.button>
        </div>
      </div>
    </Glass>
  );

  const statCards = [
    { label: "Clicks", value: (stats?.totalClicks ?? 0).toString(), icon: TrendingUp },
    { label: "Signups", value: (stats?.signups ?? referrals.length).toString(), icon: Users },
    { label: "Conv. rate", value: `${stats?.convRate ?? 0}%`, icon: Sparkles },
    { label: "Earned", value: `$${totalEarned.toFixed(2)}`, icon: DollarSign, accent: true },
  ];

  const statsGrid = (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {statCards.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i }}
        >
          <Glass className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">{s.label}</p>
              <s.icon className={"h-4 w-4 " + (s.accent ? "text-white" : "text-white/45")} />
            </div>
            <p className={"mt-3 text-[28px] font-semibold leading-none tracking-tight " + (s.accent ? "text-white" : "text-white/95")}>
              {s.value}
            </p>
          </Glass>
        </motion.div>
      ))}
    </div>
  );

  const linkRow = (label: string, value: string, isCopied: boolean, onCopy: () => void) => (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2 pl-4">
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/50">{label}</p>
        <p className="mt-0.5 truncate text-[13px] text-white/85">{value || "Loading…"}</p>
      </div>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onCopy}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] text-white/80 transition-colors hover:bg-white/[0.16]"
        aria-label={`Copy ${label}`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isCopied ? (
            <motion.span key="ok" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
              <Check className="h-4 w-4 text-emerald-300" />
            </motion.span>
          ) : (
            <motion.span key="cp" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
              <Copy className="h-4 w-4" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );

  const assetsBlock = (
    <Glass className="space-y-4 p-5 md:p-7">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-white">Your referral assets</h3>
        <GlassPill><Share2 className="h-3 w-3" /> Ready</GlassPill>
      </div>
      <div className="space-y-3">
        {linkRow("Tracking link", referralLink, copied, handleCopy)}
        {linkRow("Personal landing page", landingLink, copiedLanding, handleCopyLanding)}
      </div>

      {shareData && (
        <div className="space-y-3 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">Quick share</p>
          <div className="grid grid-cols-5 gap-2">
            {[
              { key: "whatsapp", label: "WhatsApp" },
              { key: "twitter", label: "X" },
              { key: "telegram", label: "Telegram" },
              { key: "email", label: "Email" },
              { key: "qr", label: "QR" },
            ].map((b) => (
              <motion.button
                key={b.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => (b.key === "qr" ? setShowQR(true) : handleShare(b.key))}
                className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.06] px-2 text-[11px] font-semibold text-white/85 transition-colors hover:bg-white/[0.14]"
              >
                {b.label}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </Glass>
  );

  const templatesBlock = (
    <Glass className="space-y-4 p-5 md:p-7">
      <h3 className="text-[15px] font-semibold text-white">Message templates</h3>
      <div className="space-y-3">
        {shareTemplates.map((t) => (
          <div key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">{t.label}</span>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCopyTemplate(t.id, t.text)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85 hover:text-white"
              >
                {copiedMessage === t.id ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
                {copiedMessage === t.id ? "Copied" : "Copy"}
              </motion.button>
            </div>
            <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-white/65 line-clamp-3">{t.text}</p>
          </div>
        ))}
        {shareTemplates.length === 0 && <p className="py-4 text-center text-xs text-white/40">Loading templates…</p>}
      </div>
    </Glass>
  );

  const milestonesBlock = stats && stats.milestones.length > 0 && (
    <Glass className="p-5">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">Milestones</p>
      <div className="flex flex-wrap gap-2">
        {stats.milestones.map((m) => (
          <span
            key={m.milestone_key}
            className="rounded-full border border-white/20 bg-gradient-to-b from-white/15 to-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white"
          >
            ✦ {MILESTONE_LABELS[m.milestone_key] || m.milestone_key}
          </span>
        ))}
      </div>
    </Glass>
  );

  const tabsBlock = (
    <>
      <Glass className="p-1">
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["insights", "referrals", "earnings", "withdrawals"] as const).map((t) => {
            const active = activeTab === t;
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className="relative shrink-0 flex-1 rounded-full px-4 py-2.5 text-[12px] font-semibold capitalize transition-colors"
              >
                {active && (
                  <motion.span
                    layoutId="ref-tab-pill"
                    className="absolute inset-0 rounded-full bg-white shadow-[0_6px_18px_-6px_rgba(255,255,255,0.5)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className={"relative " + (active ? "text-black" : "text-white/70")}>{t}</span>
              </button>
            );
          })}
        </div>
      </Glass>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          <Glass className="space-y-4 p-5 md:p-7">
            {activeTab === "insights" && (
              !stats ? <p className="py-10 text-center text-sm text-white/50">Loading insights…</p> : (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">Top sources</p>
                    {stats.topSources.length === 0
                      ? <p className="py-2 text-sm text-white/50">No clicks yet.</p>
                      : stats.topSources.map((s) => (
                          <div key={s.source} className="flex items-center justify-between border-b border-white/8 py-2.5 last:border-0">
                            <p className="text-sm font-medium capitalize text-white">{s.source}</p>
                            <p className="text-[11px] text-white/55">{s.clicks} clicks · {s.conversions} conv.</p>
                          </div>
                        ))}
                  </div>
                  {stats.topCountries.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">Top countries</p>
                      {stats.topCountries.map((c) => (
                        <div key={c.country} className="flex items-center justify-between border-b border-white/8 py-2.5 last:border-0">
                          <p className="text-sm font-medium text-white">{c.country}</p>
                          <p className="text-[11px] text-white/55">{c.count}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
                    <p className="text-[28px] font-semibold tracking-tight text-white">{stats.peakHour}:00 UTC</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/55">Peak click hour</p>
                  </div>
                </div>
              )
            )}
            {activeTab === "referrals" && (
              referrals.length === 0
                ? <p className="py-10 text-center text-sm text-white/50">No referrals yet. Share your link to get started.</p>
                : referrals.map((r) => (
                    <div key={r.id} className="flex items-center justify-between border-b border-white/8 py-3 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-white">User {r.referred_id.substring(0, 8)}…</p>
                        <p className="text-[11px] text-white/55">{formatDate(r.created_at)}</p>
                      </div>
                      <span className={"text-[11px] font-semibold " + (r.status === "active" ? "text-emerald-300" : "text-white/70")}>
                        {r.status}
                      </span>
                    </div>
                  ))
            )}
            {activeTab === "earnings" && (
              earnings.length === 0
                ? <p className="py-10 text-center text-sm text-white/50">No earnings yet.</p>
                : earnings.map((e) => (
                    <div key={e.id} className="flex items-center justify-between border-b border-white/8 py-3 last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-white">${Number(e.amount).toFixed(2)}</p>
                        <p className="text-[11px] text-white/55">{formatDate(e.created_at)}</p>
                      </div>
                      <span className="text-[11px] text-white/55">{e.source_action}</span>
                    </div>
                  ))
            )}
            {activeTab === "withdrawals" && (
              withdrawals.length === 0
                ? <p className="py-10 text-center text-sm text-white/50">No withdrawal requests yet.</p>
                : withdrawals.map((w) => (
                    <div key={w.id} className="flex items-center justify-between border-b border-white/8 py-3 last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-white">${Number(w.amount).toFixed(2)}</p>
                        <p className="text-[11px] text-white/55">{w.method} — {formatDate(w.created_at)}</p>
                      </div>
                      <span className={"text-[11px] font-semibold " + (
                        w.status === "completed" ? "text-emerald-300" :
                        w.status === "rejected" ? "text-rose-300" : "text-white/70"
                      )}>{w.status}</span>
                    </div>
                  ))
            )}
          </Glass>
        </motion.div>
      </AnimatePresence>
    </>
  );

  const desktopContent = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-5xl space-y-5 pb-16"
    >
      {heroBlock}
      {statsGrid}
      <div className="grid gap-5 md:grid-cols-12">
        <div className="md:col-span-7 space-y-5">{assetsBlock}</div>
        <div className="md:col-span-5">{templatesBlock}</div>
      </div>
      {milestonesBlock}
      {tabsBlock}
    </motion.div>
  );

  const mobileContent = (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pb-28">
      {heroBlock}
      {statsGrid}
      {milestonesBlock}
      {assetsBlock}
      {templatesBlock}
      {tabsBlock}
    </motion.div>
  );

  const qrModal = showQR && shareData && (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      onClick={() => setShowQR(false)}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Glass className="relative w-[20rem] max-w-full space-y-4 p-6">
          <button
            onClick={() => setShowQR(false)}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="inline-flex w-full items-center justify-center gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65">
            <QrCode className="h-3 w-3" /> Scan to join
          </p>
          <img src={shareData.qr_url} alt="Referral QR" className="w-full rounded-2xl bg-white p-3" />
          <p className="break-all text-center font-mono text-[10px] text-white/55">{shareData.url}</p>
        </Glass>
      </motion.div>
    </motion.div>
  );

  return (
    <>
      <LiveAurora tone="indigo" />

      {/* Desktop */}
      <div className="hidden md:block">
        <DesktopSettingsLayout title="Referrals" subtitle="Earn lifetime commission by inviting friends">
          {desktopContent}
        </DesktopSettingsLayout>
      </div>

      {/* Mobile */}
      <div className="block h-[100dvh] w-full overflow-y-auto overflow-x-hidden md:hidden">
        <div className="mx-auto w-full max-w-md">
          <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/8 bg-black/30 px-4 py-3 backdrop-blur-2xl">
            <button
              onClick={() => navigate("/settings")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/15"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-[17px] font-semibold tracking-tight text-white">Referrals</h1>
          </div>
          <div className="px-4 pt-4">{mobileContent}</div>
        </div>
      </div>

      <AnimatePresence>{qrModal}</AnimatePresence>
    </>
  );
};

export default ReferralsPage;
