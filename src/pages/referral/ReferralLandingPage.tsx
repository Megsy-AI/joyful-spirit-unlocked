import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface RefInfo { displayName: string; avatarUrl: string | null; }

const ReferralLandingPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [info, setInfo] = useState<RefInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    const clean = code.trim().toUpperCase().slice(0, 64);
    (async () => {
      try {
        const { data: codeRow } = await supabase
          .from("referral_codes").select("user_id").ilike("code", clean).maybeSingle();
        if (codeRow?.user_id) {
          const { data: profile } = await supabase
            .from("profiles").select("display_name, avatar_url").eq("id", codeRow.user_id).maybeSingle();
          setInfo({ displayName: profile?.display_name || "A friend", avatarUrl: profile?.avatar_url || null });
        } else {
          setInfo({ displayName: "A friend", avatarUrl: null });
        }
      } catch {
        setInfo({ displayName: "A friend", avatarUrl: null });
      } finally { setLoading(false); }
    })();
  }, [code]);

  const join = () => { if (code) navigate(`/ref/${code}`); };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const initials = (info?.displayName || "A").charAt(0).toUpperCase();

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-xl px-4 py-10 md:py-16">
        <div className="space-y-6">
          <Card>
            <CardHeader className="items-center text-center space-y-4">
              <Badge variant="secondary">دعوة شخصية</Badge>
              <Avatar className="h-20 w-20">
                {info?.avatarUrl && <AvatarImage src={info.avatarUrl} alt={info.displayName} />}
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <CardDescription>تمت دعوتك من قِبل</CardDescription>
                <CardTitle className="mt-1 text-xl">{info?.displayName}</CardTitle>
              </div>
            </CardHeader>
          </Card>

          <div className="text-center space-y-3 px-2">
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">انضم إلى Megsy AI اليوم</h1>
            <p className="mx-auto max-w-md text-base text-muted-foreground">
              مساحة عمل واحدة تجمع المحادثة والصور والفيديو والكود والبحث.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { title: "ابدأ مجاناً", desc: "بدون بطاقة" },
              { title: "كل النماذج", desc: "محادثة · صور · فيديو · كود" },
              { title: "خصوصية كاملة", desc: "بياناتك تخصك" },
            ].map((b) => (
              <Card key={b.title}>
                <CardContent className="p-4 text-center space-y-1">
                  <p className="text-sm font-semibold">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{b.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button onClick={join} size="lg" className="w-full">قبول الدعوة</Button>
          <p className="text-center text-xs text-muted-foreground">
            الكود: <span className="font-mono">{code}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReferralLandingPage;
