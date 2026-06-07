import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/cairo-tower-nile.jpg";

const WHATSAPP_PHONE = "201098821812";
const PROMOTER_MESSAGE =
  "Hello, I want to join the Megsy AI promotion / referral system. Please send me the details.";

interface Referral { id: string; status: string; created_at: string; }
interface Earning { id: string; amount: number; source_action: string; created_at: string; }
interface Withdrawal { id: string; amount: number; status: string; method: string; created_at: string; }

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const statusLabel = (s: string) =>
  ({ approved: "Approved", pending: "Pending", rejected: "Rejected", paid: "Paid", active: "Active" } as Record<string, string>)[s] ?? s;

const statusColor = (s: string) => {
  if (s === "approved" || s === "paid" || s === "active") return "bg-sky-500/15 text-sky-300 border-sky-500/30";
  if (s === "rejected") return "bg-red-500/15 text-red-300 border-red-500/30";
  return "bg-white/5 text-white/70 border-white/15";
};

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    aria-label="Back"
    className="fixed left-4 top-4 z-50 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition active:scale-95 hover:bg-white/[0.14]"
  >
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" strokeWidth="2.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 6 8.5 12l6 6" />
    </svg>
  </button>
);

const ReferralsPage = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [refs, setRefs] = useState<Referral[]>([]);
  const [earns, setEarns] = useState<Earning[]>([]);
  const [wds, setWds] = useState<Withdrawal[]>([]);
  const [tab, setTab] = useState<"referrals" | "earnings" | "withdrawals">("referrals");

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: codes } = await supabase
      .from("referral_codes").select("code").eq("user_id", user.id).limit(1);
    let c = codes?.[0]?.code as string | undefined;
    if (!c) {
      c = `MEGSY-${user.id.substring(0, 6).toUpperCase()}`;
      await supabase.from("referral_codes").insert({ user_id: user.id, code: c });
    }
    setCode(c);

    const [r, e, w] = await Promise.all([
      supabase.from("referrals").select("*").eq("referrer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("referral_earnings").select("*").eq("referrer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("withdrawal_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setRefs(r.data ?? []);
    setEarns(e.data ?? []);
    setWds(w.data ?? []);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const link = code ? `${window.location.origin}/ref/${code}` : "";
  const totalEarned = earns.reduce((s, x) => s + Number(x.amount), 0);
  const committed = wds.filter(w => w.status !== "rejected").reduce((s, x) => s + Number(x.amount), 0);
  const available = totalEarned - committed;
  const signups = refs.length;

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Link copied");
  };

  const openPromoter = () => {
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(PROMOTER_MESSAGE)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const stats = [
    { label: "Referrals", value: signups.toString() },
    { label: "Total Earnings", value: `$${totalEarned.toFixed(2)}` },
    { label: "Available", value: `$${available.toFixed(2)}` },
    { label: "Withdrawals", value: wds.length.toString() },
  ];

  return (
    <div data-theme="dark" dir="ltr" className="min-h-[100dvh] bg-background text-foreground">
      <BackButton onClick={() => navigate(-1)} />

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-8 pt-16">
        {/* Cinematic hero with Cairo Tower */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className="relative mt-6 overflow-hidden rounded-3xl"
        >
          <img
            src={heroImg}
            alt="Cairo Tower over the Nile"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b0f1f]/55 via-[#0b0f1f]/55 to-[#0b0f1f]/90" />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#1e3a8a]/40 via-transparent to-[#b91c1c]/30 mix-blend-overlay" />
          <div className="relative z-10 px-6 py-16 text-center md:px-12 md:py-28">
            <h1 className="mt-6 font-display text-[11vw] sm:text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-[0.95] text-white drop-shadow-2xl">
              Invite. Share.
              <br />
              <span className="bg-gradient-to-r from-[#3B82F6] via-[#A855F7] to-[#EF4444] bg-clip-text text-transparent">Earn for life.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-white/85 md:text-lg">
              20% commission on every subscription your friends make — renews monthly as long as they stay with us.
            </p>

            <div className="mx-auto mt-8 flex max-w-xl flex-col gap-2 rounded-2xl border border-white/15 bg-black/40 p-2 backdrop-blur sm:flex-row">
              <input
                value={link}
                readOnly
                dir="ltr"
                className="flex-1 bg-transparent px-4 py-3 font-mono text-xs text-white/90 outline-none sm:text-sm"
              />
              <button
                onClick={copyLink}
                className="rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#EF4444] px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
              >
                Copy Link
              </button>
            </div>
          </div>
        </motion.section>

        {/* Stats */}
        <section className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur"
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">{s.label}</p>
              <p className="mt-3 font-display text-3xl font-black tracking-tight text-white md:text-4xl">
                {s.value}
              </p>
            </motion.div>
          ))}
        </section>

        {/* Promoter CTA — premium card */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative mt-10 overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0d1a] p-6 sm:p-10 md:p-14"
        >
          {/* layered glows */}
          <div className="pointer-events-none absolute -top-32 right-[-10%] h-[420px] w-[420px] rounded-full bg-[#3B82F6]/35 blur-[120px]" />
          <div className="pointer-events-none absolute -bottom-32 left-[-10%] h-[420px] w-[420px] rounded-full bg-[#EF4444]/30 blur-[120px]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)]" />

          <div className="relative flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#EF4444]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/80">
                Invite-only program
              </span>
            </div>

            <h2 className="mt-6 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-5xl md:text-6xl">
              Earn up to
              <br />
              <span className="bg-gradient-to-r from-[#60A5FA] via-[#A855F7] to-[#F87171] bg-clip-text text-transparent">
                50% commission
              </span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65 sm:text-base">
              Join our official promoter network — lifetime payouts, a free subscription, and exclusive partner perks.
            </p>

            {/* perks row */}
            <div className="mt-7 grid w-full max-w-md grid-cols-3 gap-2">
              {[
                ["50%", "Commission"],
                ["FREE", "Subscription"],
                ["VIP", "Perks"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3 backdrop-blur">
                  <p className="font-display text-base font-black text-white sm:text-lg">{v}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-white/45">{l}</p>
                </div>
              ))}
            </div>

            <button
              onClick={openPromoter}
              className="group relative mt-8 w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-r from-[#3B82F6] via-[#A855F7] to-[#EF4444] p-[1.5px] shadow-2xl shadow-[#3B82F6]/25 transition hover:scale-[1.02]"
            >
              <span className="flex items-center justify-center gap-2 rounded-[14px] bg-[#0a0d1a] px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white transition group-hover:bg-transparent">
                Apply via WhatsApp
              </span>
            </button>
            <p className="mt-3 text-[11px] text-white/40">Replies usually within 24 hours</p>
          </div>
        </motion.section>

        {/* Balance + Code — clean mobile-first */}
        <section className="mt-8 space-y-4">
          {/* Balance card */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f1a3a]/80 to-[#1a0a14]/80 p-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#3B82F6]/20 blur-2xl" />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">Available balance</p>
                <p className="mt-2 font-display text-4xl font-black tracking-tight text-white sm:text-5xl">
                  ${available.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-white/45">Min $10 · 2× per month</p>
              </div>
              <button
                onClick={() => navigate("/settings/withdraw")}
                disabled={available < 10}
                className="shrink-0 rounded-2xl bg-white px-5 py-3 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
              >
                Withdraw
              </button>
            </div>
          </div>

          {/* Code card */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">Your code</p>
                <p dir="ltr" className="mt-1.5 truncate font-mono text-lg font-bold text-white">{code}</p>
              </div>
              <button
                onClick={copyLink}
                className="shrink-0 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                Copy link
              </button>
            </div>
          </div>
        </section>

        {/* Activity */}
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-xl font-black uppercase tracking-tight text-white sm:text-2xl">
              Activity
            </h3>
          </div>

          {/* segmented control */}
          <div className="flex w-full rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {([
              ["referrals", "Referrals", refs.length],
              ["earnings", "Earnings", earns.length],
              ["withdrawals", "Payouts", wds.length],
            ] as const).map(([k, label, count]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-semibold transition sm:text-sm ${
                  tab === k ? "bg-white text-black" : "text-white/55 hover:text-white"
                }`}
              >
                <span>{label}</span>
                <span className={`rounded-full px-1.5 text-[10px] ${tab === k ? "bg-black/10 text-black/70" : "bg-white/10 text-white/50"}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            {tab === "referrals" && (
              refs.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm text-white/60">No referrals yet</p>
                  <p className="mt-1 text-xs text-white/35">Share your link to start earning</p>
                </div>
              ) : refs.map((r, i) => (
                <div key={r.id} className={`flex items-center justify-between p-4 ${i ? "border-t border-white/5" : ""}`}>
                  <p className="text-sm text-white/90">Friend #{i + 1}</p>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full border px-3 py-0.5 text-[11px] ${statusColor(r.status)}`}>
                      {statusLabel(r.status)}
                    </span>
                    <span className="text-xs text-white/40">{fmtDate(r.created_at)}</span>
                  </div>
                </div>
              ))
            )}

            {tab === "earnings" && (
              earns.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm text-white/60">No earnings yet</p>
                  <p className="mt-1 text-xs text-white/35">Commissions appear after a friend subscribes</p>
                </div>
              ) : earns.map((e, i) => (
                <div key={e.id} className={`flex items-center justify-between p-4 ${i ? "border-t border-white/5" : ""}`}>
                  <div>
                    <p className="text-sm font-medium text-white/90">{e.source_action}</p>
                    <p className="text-xs text-white/40">{fmtDate(e.created_at)}</p>
                  </div>
                  <p className="bg-gradient-to-r from-[#3B82F6] to-[#EF4444] bg-clip-text text-lg font-black text-transparent">
                    +${Number(e.amount).toFixed(2)}
                  </p>
                </div>
              ))
            )}

            {tab === "withdrawals" && (
              wds.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm text-white/60">No payouts yet</p>
                  <p className="mt-1 text-xs text-white/35">Request a withdrawal once you reach $10</p>
                </div>
              ) : wds.map((w, i) => (
                <div key={w.id} className={`flex items-center justify-between p-4 ${i ? "border-t border-white/5" : ""}`}>
                  <div>
                    <p className="text-sm font-medium text-white/90">${Number(w.amount).toFixed(2)}</p>
                    <p className="text-xs text-white/40">{w.method} · {fmtDate(w.created_at)}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-0.5 text-[11px] ${statusColor(w.status)}`}>
                    {statusLabel(w.status)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

      </main>
    </div>
  );
};

export default ReferralsPage;
