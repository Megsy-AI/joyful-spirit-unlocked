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
  ({ approved: "موافق", pending: "قيد المراجعة", rejected: "مرفوض", paid: "تم الدفع" } as Record<string, string>)[s] ?? s;

const statusColor = (s: string) => {
  if (s === "approved" || s === "paid") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
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
    if (!session) throw new Error("not authenticated");
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
      toast.error("أدخل اسم الطريقة والتفاصيل");
      return;
    }
    setSubmittingMethod(true);
    try {
      await callFlow("submit_method", {
        method_type: newType, label: newLabel.trim(), instructions: newInstructions.trim(),
      });
      toast.success("تم إرسال الطلب للمراجعة. سنشعرك فور الموافقة.");
      setOpenMethod(false);
      setNewLabel(""); setNewInstructions(""); setNewType("bank");
      load();
    } catch (e: any) {
      toast.error(e.message || "فشل الإرسال");
    } finally {
      setSubmittingMethod(false);
    }
  };

  const submitWithdrawal = async () => {
    const amt = parseFloat(amount);
    if (!selectedMethodId) return toast.error("اختر طريقة دفع موافق عليها");
    if (!address.trim()) return toast.error("أدخل عنوان الاستلام");
    if (!Number.isFinite(amt) || amt < MIN_WITHDRAWAL) return toast.error(`الحد الأدنى $${MIN_WITHDRAWAL}`);
    if (amt > available) return toast.error("الرصيد غير كافٍ");
    if (usedThisMonth >= WITHDRAWALS_PER_MONTH) return toast.error("تجاوزت حد السحب الشهري");

    setSubmittingWd(true);
    try {
      await callFlow("submit_withdrawal", {
        amount: amt, payment_method_id: selectedMethodId, payment_address: address.trim(),
      });
      toast.success("تم إرسال طلب السحب. سنشعرك بنتيجة المراجعة.");
      setAmount(""); setAddress(""); setSelectedMethodId("");
      load();
    } catch (e: any) {
      toast.error(e.message || "فشل الإرسال");
    } finally {
      setSubmittingWd(false);
    }
  };

  const approvedMethods = methods.filter(m => m.status === "approved");
  const remainingThisMonth = Math.max(WITHDRAWALS_PER_MONTH - usedThisMonth, 0);

  const inputCls =
    "w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#FFD700]/60 focus:bg-white/[0.06]";
  const labelCls = "block text-[11px] uppercase tracking-[0.2em] text-white/50 mb-2";

  return (
    <div data-theme="dark" dir="rtl" className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-background/70 px-4 py-3 backdrop-blur-xl md:px-8">
        <button onClick={() => navigate("/settings/referrals")} className="text-sm text-white/60 hover:text-white transition">
          ← رجوع
        </button>
        <p className="text-xs uppercase tracking-[0.25em] text-white/40">Withdraw</p>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 pb-24 md:px-8">
        {/* Hero balance */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1305] via-black to-black p-8 md:p-14"
        >
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#FFA500]/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-[#FFD700]/10 blur-3xl" />
          <div className="relative">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">الرصيد المتاح</p>
            <h1 className="mt-4 font-display text-6xl font-black tracking-tight md:text-8xl">
              <span className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] bg-clip-text text-transparent">
                ${available.toFixed(2)}
              </span>
            </h1>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/70">
                الحد الأدنى ${MIN_WITHDRAWAL}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/70">
                متبقي هذا الشهر: {remainingThisMonth} / {WITHDRAWALS_PER_MONTH}
              </span>
            </div>
          </div>
        </motion.section>

        {/* Saved methods */}
        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-black uppercase tracking-tight md:text-3xl">طرق الدفع</h2>
              <p className="mt-1 text-sm text-white/50">كل طريقة تُراجع يدوياً قبل تفعيلها للسحب.</p>
            </div>
            <button
              onClick={() => setOpenMethod(true)}
              className="rounded-xl bg-white text-black px-5 py-3 text-sm font-bold transition hover:bg-white/90"
            >
              إضافة طريقة
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            {methods.length === 0 ? (
              <p className="p-10 text-center text-sm text-white/50">لم تضف أي طريقة دفع بعد.</p>
            ) : methods.map((m, i) => (
              <div key={m.id} className={`flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between ${i ? "border-t border-white/5" : ""}`}>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{m.label}</p>
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
                      {m.method_type === "bank" ? "بنكي" : "مخصصة"}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 line-clamp-2 whitespace-pre-line">{m.instructions}</p>
                  {m.admin_note && (
                    <p className="text-xs text-white/40">ملاحظة الإدارة: {m.admin_note}</p>
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
            <h2 className="font-display text-2xl font-black uppercase tracking-tight md:text-3xl">طلب سحب جديد</h2>
            <p className="mt-1 text-sm text-white/50">مسموح بسحبين شهرياً فقط. عنوان الاستلام مطلوب في كل عملية.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:p-8 space-y-5">
            <div>
              <label className={labelCls}>طريقة الدفع</label>
              {approvedMethods.length === 0 ? (
                <p className="text-sm text-white/50">لا توجد طرق دفع موافق عليها بعد. أضف واحدة أعلاه.</p>
              ) : (
                <select
                  value={selectedMethodId}
                  onChange={(e) => setSelectedMethodId(e.target.value)}
                  className={inputCls}
                >
                  <option value="" className="bg-background">اختر طريقة</option>
                  {approvedMethods.map((m) => (
                    <option key={m.id} value={m.id} className="bg-background">{m.label}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className={labelCls}>المبلغ (USD)</label>
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
                  الكل
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls}>عنوان الاستلام لهذه العملية</label>
              <textarea
                rows={3} value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="رقم الحساب، الإيميل، رقم المحفظة..."
                className={inputCls + " resize-none"}
              />
              <p className="mt-2 text-xs text-white/40">نطلب العنوان في كل مرة لحمايتك من الأخطاء.</p>
            </div>

            <button
              onClick={submitWithdrawal}
              disabled={submittingWd || approvedMethods.length === 0 || remainingThisMonth === 0}
              className="w-full rounded-2xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-6 py-4 text-sm font-bold uppercase tracking-wider text-black shadow-2xl shadow-[#FFA500]/20 transition hover:scale-[1.01] disabled:scale-100 disabled:opacity-50"
            >
              {submittingWd ? "جاري الإرسال…" :
               remainingThisMonth === 0 ? "تجاوزت حد السحب الشهري" :
               "إرسال طلب السحب"}
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
            dir="rtl"
          >
            <h3 className="font-display text-2xl font-black uppercase tracking-tight">إضافة طريقة دفع</h3>
            <p className="mt-1 text-sm text-white/50">سيتم إرسال طلبك للمراجعة. ستصلك إشعار بالنتيجة.</p>

            <div className="mt-6 space-y-5">
              <div>
                <label className={labelCls}>النوع</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["bank", "custom"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewType(t)}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        newType === t
                          ? "border-[#FFD700]/50 bg-[#FFD700]/10 text-white"
                          : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20"
                      }`}
                    >
                      {t === "bank" ? "حساب بنكي" : "طريقة مخصصة"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>اسم الطريقة</label>
                <input
                  value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className={inputCls}
                  placeholder={newType === "bank" ? "حسابي البنكي الأهلي" : "Vodafone Cash / PayPal"}
                />
              </div>

              <div>
                <label className={labelCls}>تفاصيل الاستلام</label>
                <textarea
                  rows={5} value={newInstructions} onChange={(e) => setNewInstructions(e.target.value)}
                  className={inputCls + " resize-none"}
                  placeholder={
                    newType === "bank"
                      ? "اسم البنك، رقم الحساب / IBAN، اسم صاحب الحساب..."
                      : "رقم محفظة، اسم خدمة، رقم تليفون..."
                  }
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setOpenMethod(false)}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              >
                إلغاء
              </button>
              <button
                onClick={submitMethod} disabled={submittingMethod}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-4 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
              >
                {submittingMethod ? "جاري الإرسال…" : "إرسال للمراجعة"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default WithdrawPage;
