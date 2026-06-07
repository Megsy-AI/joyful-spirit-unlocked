import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { DesktopSettingsLayout } from "@/components/settings/DesktopSettingsLayout";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  RadioGroup, RadioGroupItem,
} from "@/components/ui/radio-group";

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
interface WithdrawalRow {
  id: string; amount: number; status: string; created_at: string;
}

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "approved" || s === "paid") return "default";
  if (s === "rejected") return "destructive";
  return "secondary";
};

const statusAr = (s: string) =>
  ({ approved: "موافق عليها", pending: "قيد المراجعة", rejected: "مرفوضة", paid: "تم الدفع" } as Record<string, string>)[s] ?? s;

const WithdrawPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

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

  const content = (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-20">
      {/* Balance */}
      <Card>
        <CardHeader>
          <CardDescription>الرصيد المتاح للسحب</CardDescription>
          <CardTitle className="text-4xl font-semibold tracking-tight">${available.toFixed(2)}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>الحد الأدنى ${MIN_WITHDRAWAL}</span>
          <Separator orientation="vertical" className="h-4" />
          <span>متبقي هذا الشهر: {remainingThisMonth} من {WITHDRAWALS_PER_MONTH}</span>
        </CardContent>
      </Card>

      {/* Saved methods */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-lg">طرق الدفع المحفوظة</CardTitle>
            <CardDescription>تتم الموافقة على كل طريقة يدوياً قبل استخدامها للسحب.</CardDescription>
          </div>
          <Dialog open={openMethod} onOpenChange={setOpenMethod}>
            <DialogTrigger asChild>
              <Button>إضافة طريقة</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>إضافة طريقة دفع جديدة</DialogTitle>
                <DialogDescription>
                  أدخل تفاصيل واضحة. سيتم إرسال طلبك للمراجعة وستصلك إشعار بالنتيجة.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>النوع</Label>
                  <RadioGroup value={newType} onValueChange={(v) => setNewType(v as "bank" | "custom")} className="flex gap-4">
                    <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 has-[:checked]:border-primary">
                      <RadioGroupItem value="bank" /> حساب بنكي
                    </Label>
                    <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 has-[:checked]:border-primary">
                      <RadioGroupItem value="custom" /> طريقة مخصصة
                    </Label>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="m-label">اسم الطريقة</Label>
                  <Input
                    id="m-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                    placeholder={newType === "bank" ? "مثال: حسابي البنكي الأهلي" : "مثال: Vodafone Cash / PayPal"}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="m-instructions">تفاصيل الاستلام</Label>
                  <Textarea
                    id="m-instructions" rows={5} value={newInstructions}
                    onChange={(e) => setNewInstructions(e.target.value)}
                    placeholder={
                      newType === "bank"
                        ? "اسم البنك، رقم الحساب / IBAN، اسم صاحب الحساب، أي تعليمات إضافية"
                        : "اشرح كيف تريد استلام الأموال (مثال: رقم محفظة، اسم خدمة، رقم تليفون...)"
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenMethod(false)}>إلغاء</Button>
                <Button onClick={submitMethod} disabled={submittingMethod}>
                  {submittingMethod ? "جاري الإرسال…" : "إرسال للمراجعة"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {methods.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">لم تضف أي طريقة دفع بعد.</p>
          ) : methods.map((m, i) => (
            <div key={m.id}>
              <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{m.label}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {m.method_type === "bank" ? "بنكي" : "مخصصة"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">
                    {m.instructions}
                  </p>
                </div>
                <Badge variant={statusVariant(m.status)} className="self-start sm:self-auto">
                  {statusAr(m.status)}
                </Badge>
              </div>
              {i < methods.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Withdraw form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">طلب سحب جديد</CardTitle>
          <CardDescription>
            مسموح بسحبين شهرياً فقط. يجب إدخال عنوان الاستلام في كل مرة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>طريقة الدفع</Label>
            {approvedMethods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                لا توجد طرق دفع موافق عليها بعد. أضف واحدة وانتظر الموافقة.
              </p>
            ) : (
              <Select value={selectedMethodId} onValueChange={setSelectedMethodId}>
                <SelectTrigger><SelectValue placeholder="اختر طريقة" /></SelectTrigger>
                <SelectContent>
                  {approvedMethods.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">المبلغ (USD)</Label>
            <div className="flex gap-2">
              <Input
                id="amount" type="number" inputMode="decimal" min={MIN_WITHDRAWAL} max={available}
                value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder={MIN_WITHDRAWAL.toString()}
              />
              <Button type="button" variant="outline" onClick={() => setAmount(available.toFixed(2))} disabled={available <= 0}>
                الكل
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="addr">عنوان الاستلام لهذه العملية</Label>
            <Textarea
              id="addr" rows={3} value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="أدخل عنوان الاستلام الكامل (رقم الحساب، الإيميل، رقم المحفظة…) لهذه المعاملة."
            />
            <p className="text-xs text-muted-foreground">
              نطلب العنوان في كل مرة لحمايتك من الأخطاء.
            </p>
          </div>

          <Button
            onClick={submitWithdrawal}
            disabled={submittingWd || approvedMethods.length === 0 || remainingThisMonth === 0}
            className="w-full" size="lg"
          >
            {submittingWd ? "جاري الإرسال…" :
             remainingThisMonth === 0 ? "تجاوزت حد السحب الشهري" :
             "إرسال طلب السحب"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  if (!isMobile) {
    return (
      <DesktopSettingsLayout title="السحب" subtitle="إدارة طرق الدفع وطلبات السحب">
        {content}
      </DesktopSettingsLayout>
    );
  }
  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={() => navigate("/settings/referrals")}>رجوع</Button>
        <h1 className="text-base font-semibold">السحب</h1>
      </header>
      <div className="px-4 py-5">{content}</div>
    </div>
  );
};

export default WithdrawPage;
