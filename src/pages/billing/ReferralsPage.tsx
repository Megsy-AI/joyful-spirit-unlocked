import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { DesktopSettingsLayout } from "@/components/settings/DesktopSettingsLayout";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const WHATSAPP_PHONE = "201098821812";
const PROMOTER_MESSAGE =
  "مرحباً، أريد الانضمام إلى نظام الترويج / الإحالة الخاص بـ Megsy AI. أرجو إرسال التفاصيل.";

interface Referral { id: string; status: string; created_at: string; }
interface Earning { id: string; amount: number; source_action: string; created_at: string; }
interface Withdrawal { id: string; amount: number; status: string; method: string; created_at: string; }

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "approved" || s === "paid" || s === "active") return "default";
  if (s === "rejected") return "destructive";
  return "secondary";
};

const ReferralsPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [code, setCode] = useState("");
  const [refs, setRefs] = useState<Referral[]>([]);
  const [earns, setEarns] = useState<Earning[]>([]);
  const [wds, setWds] = useState<Withdrawal[]>([]);

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
    toast.success("تم نسخ الرابط");
  };

  const openPromoter = () => {
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(PROMOTER_MESSAGE)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const content = (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-20">
      {/* Hero */}
      <Card>
        <CardHeader className="space-y-3">
          <Badge variant="secondary" className="w-fit">برنامج الإحالة</Badge>
          <CardTitle className="text-3xl md:text-4xl font-semibold tracking-tight">
            ادعُ أصدقاءك. اربح مدى الحياة.
          </CardTitle>
          <CardDescription className="text-base">
            احصل على عمولة 15% من كل اشتراك يقوم به أصدقاؤك — تتجدد كل شهر طالما بقوا معنا.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center">
            <Input value={link} readOnly className="font-mono text-sm" />
            <Button onClick={copyLink} className="shrink-0">نسخ الرابط</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/settings/withdraw")}>
              سحب الأرباح
            </Button>
            <Button variant="outline" onClick={openPromoter}>
              كن مروّجاً وكسب حتى 50% — تواصل عبر واتساب
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "إحالات", value: signups.toString() },
          { label: "إجمالي الأرباح", value: `$${totalEarned.toFixed(2)}` },
          { label: "الرصيد المتاح", value: `$${available.toFixed(2)}` },
          { label: "طلبات السحب", value: wds.length.toString() },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Promoter callout */}
      <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex flex-col items-start gap-3 p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">هل تريد أن تكون مروّجاً رسمياً؟</h3>
            <p className="text-sm text-muted-foreground">
              عمولة تصل إلى 50% من الأرباح + اشتراك مجاني + مزايا حصرية.
            </p>
          </div>
          <Button onClick={openPromoter} size="lg">انضم الآن عبر واتساب</Button>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="referrals" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="referrals">الإحالات</TabsTrigger>
          <TabsTrigger value="earnings">الأرباح</TabsTrigger>
          <TabsTrigger value="withdrawals">السحوبات</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {refs.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">لا يوجد إحالات بعد.</p>
              ) : refs.map((r, i) => (
                <div key={r.id}>
                  <div className="flex items-center justify-between p-4">
                    <p className="text-sm">صديق #{i + 1}</p>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                      <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>
                    </div>
                  </div>
                  {i < refs.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {earns.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">لم تربح شيئاً بعد.</p>
              ) : earns.map((e, i) => (
                <div key={e.id}>
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">{e.source_action}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(e.created_at)}</p>
                    </div>
                    <p className="text-base font-semibold">+${Number(e.amount).toFixed(2)}</p>
                  </div>
                  {i < earns.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {wds.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">لا يوجد طلبات سحب.</p>
              ) : wds.map((w, i) => (
                <div key={w.id}>
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">${Number(w.amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{w.method} · {fmtDate(w.created_at)}</p>
                    </div>
                    <Badge variant={statusVariant(w.status)}>{w.status}</Badge>
                  </div>
                  {i < wds.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );

  if (!isMobile) {
    return (
      <DesktopSettingsLayout title="الإحالات" subtitle="ادعُ أصدقاءك واربح عمولة مدى الحياة">
        {content}
      </DesktopSettingsLayout>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>رجوع</Button>
        <h1 className="text-base font-semibold">الإحالات</h1>
      </header>
      <div className="px-4 py-5">{content}</div>
    </div>
  );
};

export default ReferralsPage;
