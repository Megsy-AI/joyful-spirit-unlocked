import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_PHONE = "201098821812";
const PROMOTER_MESSAGE =
  "Hello, I want to join the Megsy AI promotion / referral system. Please send me the details.";

interface Referral { id: string; status: string; created_at: string; }
interface Earning { id: string; amount: number; source_action: string; created_at: string; }
interface Withdrawal { id: string; amount: number; status: string; method: string; created_at: string; }

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const statusLabel = (s: string) =>
  ({ approved: "Approved", pending: "Pending", rejected: "Rejected", paid: "Paid", active: "Active" } as Record<string, string>)[s] ?? s;

const statusDot = (s: string) => {
  if (s === "approved" || s === "paid" || s === "active") return "bg-emerald-400";
  if (s === "rejected") return "bg-red-400";
  return "bg-white/30";
};

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    aria-label="Back"
    className="fixed left-4 top-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/40 text-white/90 backdrop-blur-xl transition active:scale-95 hover:bg-black/60"
  >
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" strokeWidth="2.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
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

  const copyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Code copied");
  };

  const openPromoter = () => {
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(PROMOTER_MESSAGE)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div data-theme="dark" dir="ltr" className="min-h-[100dvh] bg-[#08090b] text-white antialiased">
      <BackButton onClick={() => navigate(-1)} />

      <main className="mx-auto w-full max-w-2xl px-5 pb-32 pt-20 sm:px-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">Referrals</p>
          <h1 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[40px]">
            Earn 20% for life,<br />
            <span className="text-white/45">on every friend you invite.</span>
          </h1>
        </motion.header>

        {/* Balance — hero card */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="relative mt-8 overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-[#0f1530] via-[#0a0d1a] to-[#1a0a18] p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-red-500/15 blur-3xl" />

          <div className="relative">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">Available balance</p>
            <p className="mt-3 text-[56px] font-semibold leading-none tracking-tight sm:text-[64px]">
              <span className="text-white/40">$</span>{available.toFixed(2)}
            </p>
            <p className="mt-3 text-sm text-white/45">
              ${totalEarned.toFixed(2)} earned · min $10 to withdraw
            </p>

            <button
              onClick={() => navigate("/settings/withdraw")}
              disabled={available < 10}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 sm:w-auto sm:px-8"
            >
              Withdraw
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" stroke="currentColor" className="h-4 w-4">
                <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </motion.section>

        {/* Stats — minimal */}
        <section className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Referrals", value: signups.toString() },
            { label: "Earnings", value: `$${totalEarned.toFixed(0)}` },
            { label: "Payouts", value: wds.length.toString() },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">{s.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{s.value}</p>
            </div>
          ))}
        </section>

        {/* Share link */}
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-white/90">Your invite link</h2>
            <button onClick={copyCode} className="text-xs text-white/45 transition hover:text-white/80">
              {code || "—"}
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1.5">
            <input
              value={link}
              readOnly
              dir="ltr"
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-[12px] text-white/80 outline-none"
            />
            <button
              onClick={copyLink}
              className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-white/90"
            >
              Copy
            </button>
          </div>
        </section>

        {/* Promoter banner — minimal, clean */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0c0e14]"
        >
          <div className="relative p-6 sm:p-7">
            <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/30 to-red-500/20">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" className="h-5 w-5">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6L12 2z" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">Partner Program</p>
                <h3 className="mt-1.5 text-lg font-semibold tracking-tight">Become a top promoter</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                  Up to <span className="text-white">50% commission</span>, a free subscription, and VIP perks.
                </p>
                <button
                  onClick={openPromoter}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.08]"
                >
                  Apply via WhatsApp
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" stroke="currentColor" className="h-3.5 w-3.5">
                    <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Activity */}
        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold text-white/90">Activity</h2>

          <div className="flex w-full gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1">
            {([
              ["referrals", "Referrals", refs.length],
              ["earnings", "Earnings", earns.length],
              ["withdrawals", "Payouts", wds.length],
            ] as const).map(([k, label, count]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${
                  tab === k ? "bg-white/[0.08] text-white" : "text-white/45 hover:text-white/80"
                }`}
              >
                {label}
                <span className="text-[10px] text-white/35">{count}</span>
              </button>
            ))}
          </div>

          <div className="mt-3">
            {tab === "referrals" && (
              refs.length === 0 ? (
                <EmptyState title="No referrals yet" hint="Share your link to start earning." />
              ) : (
                <ul className="divide-y divide-white/[0.05] rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                  {refs.map((r, i) => (
                    <li key={r.id} className="flex items-center justify-between px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className={`h-2 w-2 rounded-full ${statusDot(r.status)}`} />
                        <p className="text-sm">Friend #{i + 1}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-white/45">
                        <span>{statusLabel(r.status)}</span>
                        <span>·</span>
                        <span>{fmtDate(r.created_at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            )}

            {tab === "earnings" && (
              earns.length === 0 ? (
                <EmptyState title="No earnings yet" hint="Commissions appear after a friend subscribes." />
              ) : (
                <ul className="divide-y divide-white/[0.05] rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                  {earns.map((e) => (
                    <li key={e.id} className="flex items-center justify-between px-4 py-3.5">
                      <div>
                        <p className="text-sm">{e.source_action}</p>
                        <p className="text-xs text-white/40">{fmtDate(e.created_at)}</p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-400">
                        +${Number(e.amount).toFixed(2)}
                      </p>
                    </li>
                  ))}
                </ul>
              )
            )}

            {tab === "withdrawals" && (
              wds.length === 0 ? (
                <EmptyState title="No payouts yet" hint="Request a withdrawal once you reach $10." />
              ) : (
                <ul className="divide-y divide-white/[0.05] rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                  {wds.map((w) => (
                    <li key={w.id} className="flex items-center justify-between px-4 py-3.5">
                      <div>
                        <p className="text-sm">${Number(w.amount).toFixed(2)}</p>
                        <p className="text-xs text-white/40">{w.method} · {fmtDate(w.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/55">
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDot(w.status)}`} />
                        {statusLabel(w.status)}
                      </div>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

const EmptyState = ({ title, hint }: { title: string; hint: string }) => (
  <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] px-6 py-12 text-center">
    <p className="text-sm text-white/70">{title}</p>
    <p className="mt-1 text-xs text-white/40">{hint}</p>
  </div>
);

export default ReferralsPage;
