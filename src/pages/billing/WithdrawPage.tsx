import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MIN_WITHDRAWAL = 10;
const WITHDRAWALS_PER_MONTH = 2;

interface PaymentMethod {
  id: string;
  method_type: string;
  label: string;
  instructions: string;
  status: "pending" | "approved" | "rejected";
  admin_note?: string | null;
  created_at: string;
}

const statusLabel = (s: string) =>
  ({ approved: "Approved", pending: "Pending", rejected: "Rejected", paid: "Paid" } as Record<string, string>)[s] ?? s;

const statusColor = (s: string) => {
  if (s === "approved" || s === "paid") return "bg-sky-500/15 text-sky-300 border-sky-500/30";
  if (s === "rejected") return "bg-red-500/15 text-red-300 border-red-500/30";
  return "bg-white/5 text-white/70 border-white/15";
};

const WithdrawPage = () => {
  const navigate = useNavigate();

  const [available, setAvailable] = useState(0);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [usedThisMonth, setUsedThisMonth] = useState(0);

  // Withdraw form
  const [amount, setAmount] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [address, setAddress] = useState("");
  const [submittingWd, setSubmittingWd] = useState(false);

  // New method form
  const [openMethod, setOpenMethod] = useState(false);
  const [newType, setNewType] = useState<"bank" | "custom">("bank");
  const [newLabel, setNewLabel] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [submittingMethod, setSubmittingMethod] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [earnsRes, wdsRes, methodsRes] = await Promise.all([
      supabase.from("referral_earnings").select("amount").eq("referrer_id", user.id),
      supabase.from("withdrawal_requests").select("amount, status, created_at").eq("user_id", user.id),
      supabase.from("user_payment_methods").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    const totalEarned = (earnsRes.data ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
    const committed = (wdsRes.data ?? []).filter((w: any) => w.status !== "rejected")
      .reduce((s, r: any) => s + Number(r.amount), 0);
    setAvailable(totalEarned - committed);

    const monthStart = new Date();
    monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const used = (wdsRes.data ?? []).filter(
      (w: any) => w.status !== "rejected" && new Date(w.created_at) >= monthStart
    ).length;
    setUsedThisMonth(used);

    setMethods((methodsRes.data ?? []) as PaymentMethod[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const callFlow = async (op: string, payload: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        "X-User-Flow": "1",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ op, ...payload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  };

  const submitMethod = async () => {
    if (!newLabel.trim() || !newInstructions.trim()) {
      toast.error("Enter the method name and details");
      return;
    }
    setSubmittingMethod(true);
    try {
      await callFlow("submit_method", {
        method_type: newType, label: newLabel.trim(), instructions: newInstructions.trim(),
      });
      toast.success("Request sent for review. We'll notify you once approved.");
      setOpenMethod(false);
      setNewLabel(""); setNewInstructions(""); setNewType("bank");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to send");
    } finally {
      setSubmittingMethod(false);
    }
  };

  const submitWithdrawal = async () => {
    const amt = parseFloat(amount);
    if (!selectedMethodId) return toast.error("Select an approved payment method");
    if (!address.trim()) return toast.error("Enter a payout address");
    if (!Number.isFinite(amt) || amt < MIN_WITHDRAWAL) return toast.error(`Minimum withdrawal is $${MIN_WITHDRAWAL}`);
    if (amt > available) return toast.error("Insufficient balance");
    if (usedThisMonth >= WITHDRAWALS_PER_MONTH) return toast.error("Monthly withdrawal limit exceeded");

    setSubmittingWd(true);
    try {
      await callFlow("submit_withdrawal", {
        amount: amt, payment_method_id: selectedMethodId, payment_address: address.trim(),
      });
      toast.success("Withdrawal request sent. We'll notify you of the review result.");
      setAmount(""); setAddress(""); setSelectedMethodId("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to send");
    } finally {
      setSubmittingWd(false);
    }
  };

  const approvedMethods = methods.filter(m => m.status === "approved");
  const remainingThisMonth = Math.max(WITHDRAWALS_PER_MONTH - usedThisMonth, 0);

  const inputCls =
    "w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#3B82F6]/60 focus:bg-white/[0.06]";
  const labelCls = "block text-[11px] uppercase tracking-[0.2em] text-white/50 mb-2";

  return (
    <div data-theme="dark" dir="ltr" className="min-h-[100dvh] bg-background text-foreground">
      {/* iOS-style floating back button */}
      <button
        onClick={() => navigate("/settings/referrals")}
        aria-label="Back"
        className="fixed left-4 top-4 z-50 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition active:scale-95 hover:bg-white/[0.14]"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" strokeWidth="2.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 6 8.5 12l6 6" />
        </svg>
      </button>

      <main className="mx-auto w-full max-w-4xl px-4 pb-24 md:px-8 pt-16">
        {/* Hero balance */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0a1428] via-black to-[#1a0a0f] p-8 md:p-14"
        >
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#3B82F6]/25 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-[#EF4444]/20 blur-3xl" />
          <div className="relative">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Available Balance</p>
            <h1 className="mt-4 font-display text-6xl font-black tracking-tight md:text-8xl">
              <span className="bg-gradient-to-r from-[#3B82F6] via-[#A855F7] to-[#EF4444] bg-clip-text text-transparent">
                ${available.toFixed(2)}
              </span>
            </h1>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/70">
                Min ${MIN_WITHDRAWAL}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/70">
                Remaining this month: {remainingThisMonth} / {WITHDRAWALS_PER_MONTH}
              </span>
            </div>
          </div>
        </motion.section>

        {/* Saved methods */}
        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-black uppercase tracking-tight md:text-3xl">Payment Methods</h2>
              <p className="mt-1 text-sm text-white/50">Each method is reviewed manually before activation.</p>
            </div>
            <button
              onClick={() => setOpenMethod(true)}
              className="rounded-xl bg-white text-black px-5 py-3 text-sm font-bold transition hover:bg-white/90"
            >
              Add Method
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            {methods.length === 0 ? (
              <p className="p-10 text-center text-sm text-white/50">No payment methods added yet.</p>
            ) : methods.map((m, i) => (
              <div key={m.id} className={`flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between ${i ? "border-t border-white/5" : ""}`}>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{m.label}</p>
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
                      {m.method_type === "bank" ? "Bank" : "Custom"}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 line-clamp-2 whitespace-pre-line">{m.instructions}</p>
                  {m.admin_note && (
                    <p className="text-xs text-white/40">Admin note: {m.admin_note}</p>
                  )}
                </div>
                <span className={`self-start rounded-full border px-3 py-1 text-[11px] sm:self-auto ${statusColor(m.status)}`}>
                  {statusLabel(m.status)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Withdraw form */}
        <section className="mt-12">
          <div className="mb-5">
            <h2 className="font-display text-2xl font-black uppercase tracking-tight md:text-3xl">New Withdrawal Request</h2>
            <p className="mt-1 text-sm text-white/50">Only two withdrawals allowed per month. A payout address is required every time.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:p-8 space-y-5">
            <div>
              <label className={labelCls}>Payment Method</label>
              {approvedMethods.length === 0 ? (
                <p className="text-sm text-white/50">No approved payment methods yet. Add one above.</p>
              ) : (
                <select
                  value={selectedMethodId}
                  onChange={(e) => setSelectedMethodId(e.target.value)}
                  className={inputCls}
                >
                  <option value="" className="bg-background">Select method</option>
                  {approvedMethods.map((m) => (
                    <option key={m.id} value={m.id} className="bg-background">{m.label}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className={labelCls}>Amount (USD)</label>
              <div className="flex gap-2">
                <input
                  type="number" inputMode="decimal" min={MIN_WITHDRAWAL} max={available}
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder={MIN_WITHDRAWAL.toString()} className={inputCls}
                />
                <button
                  type="button" disabled={available <= 0}
                  onClick={() => setAmount(available.toFixed(2))}
                  className="rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-40"
                >
                  Max
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls}>Payout Address for this transaction</label>
              <textarea
                rows={3} value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="Account number, email, wallet address..."
                className={inputCls + " resize-none"}
              />
              <p className="mt-2 text-xs text-white/40">We ask for the address every time to protect you from mistakes.</p>
            </div>

            <button
              onClick={submitWithdrawal}
              disabled={submittingWd || approvedMethods.length === 0 || remainingThisMonth === 0}
              className="w-full rounded-2xl bg-gradient-to-r from-[#3B82F6] to-[#EF4444] px-6 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-2xl shadow-[#3B82F6]/25 transition hover:scale-[1.01] disabled:scale-100 disabled:opacity-50"
            >
              {submittingWd ? "Sending…" :
               remainingThisMonth === 0 ? "Monthly limit exceeded" :
               "Submit Withdrawal Request"}
            </button>
          </div>
        </section>
      </main>

      {/* Add method modal */}
      {openMethod && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm md:items-center" onClick={() => setOpenMethod(false)}>
          <motion.div
            initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-background p-6 md:p-8"
            dir="ltr"
          >
            <h3 className="font-display text-2xl font-black uppercase tracking-tight">Add Payment Method</h3>
            <p className="mt-1 text-sm text-white/50">Your request will be sent for review. You'll be notified of the result.</p>

            <div className="mt-6 space-y-5">
              <div>
                <label className={labelCls}>Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["bank", "custom"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewType(t)}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        newType === t
                          ? "border-[#3B82F6]/60 bg-[#3B82F6]/10 text-white"
                          : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20"
                      }`}
                    >
                      {t === "bank" ? "Bank Account" : "Custom"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Method Name</label>
                <input
                  value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className={inputCls}
                  placeholder={newType === "bank" ? "My National Bank Account" : "Vodafone Cash / PayPal"}
                />
              </div>

              <div>
                <label className={labelCls}>Payout Details</label>
                <textarea
                  rows={5} value={newInstructions} onChange={(e) => setNewInstructions(e.target.value)}
                  className={inputCls + " resize-none"}
                  placeholder={
                    newType === "bank"
                      ? "Bank name, account number / IBAN, account holder name..."
                      : "Wallet number, service name, phone number..."
                  }
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setOpenMethod(false)}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={submitMethod} disabled={submittingMethod}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#EF4444] px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {submittingMethod ? "Sending…" : "Send for Review"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default WithdrawPage;