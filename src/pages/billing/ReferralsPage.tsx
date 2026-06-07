import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import referralBanner from "@/assets/referral-banner.webp";

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
  if (s === "approved" || s === "paid" || s === "active") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (s === "rejected") return "bg-red-500/15 text-red-300 border-red-500/30";
  return "bg-white/5 text-white/70 border-white/15";
};

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
      {/* Floating back button */}
      <button
        onClick={() => navigate(-1)}
        className="fixed left-4 top-4 z-50 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/80 shadow-lg backdrop-blur-xl transition hover:bg-white/[0.12] hover:text-white"
      >
        Back
      </button>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-8 pt-16">
        {/* Cinematic hero */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className="relative mt-6 overflow-hidden rounded-3xl"
        >
          <img
            src={referralBanner}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/55 to-black/85" />
          <div className="relative z-10 px-6 py-16 text-center md:px-12 md:py-28">
            <span className="inline-block rounded-full border border-white/20 bg-white/5 px-4 py-1 text-[10px] uppercase tracking-[0.3em] text-white/80 backdrop-blur">
              Megsy Affiliate
            </span>
            <h1 className="mt-6 font-display text-[11vw] sm:text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-[0.95] text-white drop-shadow-2xl">
              Invite. Share.
              <br />
              <span className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] bg-clip-text text-transparent">Earn for life.</span>
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
                className="rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-6 py-3 text-sm font-bold text-black transition hover:opacity-90"
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

        {/* Promoter CTA — cinematic */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative mt-10 overflow-hidden rounded-3xl border border-[#FFD700]/30 bg-gradient-to-br from-[#1a1305] via-black to-black p-8 md:p-12"
        >
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#FFA500]/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-[#FFD700]/15 blur-3xl" />
          <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#FFD700]">Official Partnership</span>
              <h2 className="mt-3 font-display text-3xl font-black uppercase tracking-tight text-white md:text-5xl">
                Become an <span className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] bg-clip-text text-transparent">Official Promoter</span>
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/70 md:text-base">
                Commission up to 50% of earnings + free subscription + exclusive perks. Contact us now via WhatsApp and join the elite promoters.
              </p>
            </div>
            <button
              onClick={openPromoter}
              className="self-start rounded-2xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-8 py-4 text-sm font-bold uppercase tracking-wider text-black shadow-2xl shadow-[#FFA500]/30 transition hover:scale-[1.02]"
            >
              Join via WhatsApp
            </button>
          </div>
        </motion.section>

        {/* Withdraw CTA */}
        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Ready to withdraw</p>
            <p className="mt-3 font-display text-4xl font-black text-white">${available.toFixed(2)}</p>
            <button
              onClick={() => navigate("/settings/withdraw")}
              className="mt-5 w-full rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Withdraw Earnings
            </button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Your referral code</p>
            <p dir="ltr" className="mt-3 font-mono text-2xl font-bold text-white">{code}</p>
            <button
              onClick={copyLink}
              className="mt-5 w-full rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Copy Invite Link
            </button>
          </div>
        </section>

        {/* Tabs */}
        <section className="mt-12">
          <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {([
              ["referrals", "Referrals"],
              ["earnings", "Earnings"],
              ["withdrawals", "Withdrawals"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
                  tab === k ? "bg-white text-black" : "text-white/60 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            {tab === "referrals" && (
              refs.length === 0 ? (
                <p className="p-10 text-center text-sm text-white/50">No referrals yet.</p>
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
                <p className="p-10 text-center text-sm text-white/50">No earnings yet.</p>
              ) : earns.map((e, i) => (
                <div key={e.id} className={`flex items-center justify-between p-4 ${i ? "border-t border-white/5" : ""}`}>
                  <div>
                    <p className="text-sm font-medium text-white/90">{e.source_action}</p>
                    <p className="text-xs text-white/40">{fmtDate(e.created_at)}</p>
                  </div>
                  <p className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] bg-clip-text text-lg font-black text-transparent">
                    +${Number(e.amount).toFixed(2)}
                  </p>
                </div>
              ))
            )}

            {tab === "withdrawals" && (
              wds.length === 0 ? (
                <p className="p-10 text-center text-sm text-white/50">No withdrawal requests.</p>
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