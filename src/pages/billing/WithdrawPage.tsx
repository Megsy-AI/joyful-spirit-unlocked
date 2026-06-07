import { ArrowLeft, Wallet, ArrowRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { DesktopSettingsLayout } from "@/components/settings/DesktopSettingsLayout";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import LiveAurora from "@/components/referral/LiveAurora";

const MIN_WITHDRAWAL = 10;

const Glass = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={
      "relative rounded-[26px] border border-white/12 bg-white/[0.06] " +
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_30px_60px_-30px_rgba(0,0,0,0.6)] " +
      "backdrop-blur-2xl backdrop-saturate-150 " +
      className
    }
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
  </div>
);

const WithdrawPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [availableBalance, setAvailableBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("paypal");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadBalance = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: earns } = await supabase.from("referral_earnings").select("amount").eq("referrer_id", user.id);
    const { data: wds } = await supabase.from("withdrawal_requests").select("amount, status").eq("user_id", user.id);
    const totalEarned = (earns || []).reduce((s, e) => s + Number(e.amount), 0);
    const totalWithdrawn = (wds || []).filter((w) => w.status !== "rejected").reduce((s, w) => s + Number(w.amount), 0);
    setAvailableBalance(totalEarned - totalWithdrawn);
  }, []);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < MIN_WITHDRAWAL) { toast.error(`Minimum withdrawal is $${MIN_WITHDRAWAL}`); return; }
    if (amt > availableBalance) { toast.error("Insufficient balance"); return; }
    if (!details.trim()) { toast.error("Enter your payment details"); return; }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const { error } = await supabase.from("withdrawal_requests").insert({
      user_id: user.id, amount: amt, method, payment_details: details.trim(),
    });

    setSubmitting(false);
    if (error) toast.error("Failed to submit request");
    else {
      toast.success("Withdrawal request submitted");
      navigate("/settings/referrals");
    }
  };

  const methodOptions = [
    { id: "paypal", label: "PayPal", placeholder: "your@email.com" },
    { id: "payoneer", label: "Payoneer", placeholder: "Payoneer email or ID" },
    { id: "vodafone_cash", label: "Vodafone Cash", placeholder: "01xxxxxxxxx" },
    { id: "bank", label: "Bank Transfer", placeholder: "IBAN / Account number" },
  ];

  const activeMethod = methodOptions.find((m) => m.id === method);

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-lg space-y-5 pb-20"
    >
      {/* Balance hero */}
      <Glass className="overflow-hidden p-8 text-center">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl">
          <Wallet className="h-6 w-6 text-white" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">Available balance</p>
        <motion.p
          key={availableBalance}
          initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="mt-2 text-[56px] font-semibold leading-none tracking-tight text-white"
        >
          ${availableBalance.toFixed(2)}
        </motion.p>
        <p className="mt-3 text-[12px] text-white/55">Minimum withdrawal: ${MIN_WITHDRAWAL}</p>
      </Glass>

      {/* Amount */}
      <Glass className="space-y-3 p-5">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
          Amount
        </label>
        <div className="flex items-end gap-2">
          <span className="text-[34px] font-semibold leading-none text-white/60">$</span>
          <input
            type="number"
            inputMode="decimal"
            min={MIN_WITHDRAWAL}
            max={availableBalance}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={MIN_WITHDRAWAL.toString()}
            className="flex-1 border-0 bg-transparent text-[44px] font-semibold tracking-tight text-white outline-none placeholder:text-white/25"
          />
          {availableBalance > 0 && (
            <button
              onClick={() => setAmount(availableBalance.toFixed(2))}
              className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/85 hover:bg-white/20"
            >
              Max
            </button>
          )}
        </div>
      </Glass>

      {/* Method */}
      <Glass className="space-y-3 p-5">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
          Payment method
        </label>
        <div className="grid grid-cols-2 gap-2">
          {methodOptions.map((opt) => {
            const active = method === opt.id;
            return (
              <motion.button
                key={opt.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => setMethod(opt.id)}
                className={
                  "relative flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-[13px] font-semibold transition-all " +
                  (active
                    ? "border-white/30 bg-white text-black shadow-[0_10px_24px_-12px_rgba(255,255,255,0.55)]"
                    : "border-white/10 bg-white/[0.05] text-white/80 hover:bg-white/[0.12]")
                }
              >
                <span>{opt.label}</span>
                {active && <Check className="h-4 w-4" />}
              </motion.button>
            );
          })}
        </div>
      </Glass>

      {/* Details */}
      <Glass className="space-y-2 p-5">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
          {activeMethod?.label} details
        </label>
        <input
          type="text"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={activeMethod?.placeholder}
          className="w-full border-0 border-b border-white/15 bg-transparent py-2 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/45"
        />
      </Glass>

      {/* Submit */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={handleSubmit}
        disabled={submitting}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-[15px] font-semibold text-black shadow-[0_18px_40px_-12px_rgba(255,255,255,0.55)] transition-all disabled:opacity-60"
      >
        {submitting ? "Submitting…" : (<>Submit withdrawal request <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>)}
      </motion.button>

      <p className="text-center text-[11px] leading-relaxed text-white/45">
        Requests are processed within 3–5 business days. You'll get a notification once your payment is sent.
      </p>
    </motion.div>
  );

  return (
    <>
      <LiveAurora tone="mint" />
      {!isMobile ? (
        <DesktopSettingsLayout title="Withdraw" subtitle="Request a payout from your referral earnings">
          {content}
        </DesktopSettingsLayout>
      ) : (
        <div className="h-[100dvh] w-full overflow-y-auto">
          <div className="mx-auto max-w-lg">
            <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/8 bg-black/30 px-4 py-3 backdrop-blur-2xl">
              <button
                onClick={() => navigate("/settings/referrals")}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/15"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-[17px] font-semibold tracking-tight text-white">Withdraw</h1>
            </div>
            <div className="px-4 pt-4">{content}</div>
          </div>
        </div>
      )}
    </>
  );
};

export default WithdrawPage;
