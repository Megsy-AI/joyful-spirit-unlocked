import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import referralBanner from "@/assets/referral-banner.webp";

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
  const initials = (info?.displayName || "A").charAt(0).toUpperCase();

  if (loading) {
    return (
      <div data-theme="dark" className="flex min-h-[100dvh] items-center justify-center bg-background">
        <p className="text-sm text-white/50">Loading…</p>
      </div>
    );
  }

  return (
    <div data-theme="dark" dir="rtl" className="min-h-[100dvh] bg-background text-foreground overflow-hidden">
      {/* Cinematic background */}
      <div className="absolute inset-0 -z-10">
        <img src={referralBanner} alt="" className="h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/85 to-background" />
      </div>

      <main className="relative mx-auto flex min-h-[100dvh] max-w-2xl flex-col items-center justify-center px-5 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
          className="space-y-8"
        >
          <span className="inline-block rounded-full border border-[#FFD700]/30 bg-[#FFD700]/5 px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] text-[#FFD700]">
            دعوة شخصية
          </span>

          {/* Invitor card */}
          <div className="mx-auto flex max-w-sm items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-xl font-black text-black">
              {info?.avatarUrl ? (
                <img src={info.avatarUrl} alt={info.displayName} className="h-full w-full object-cover" />
              ) : initials}
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">دعاك</p>
              <p className="mt-0.5 text-base font-bold text-white">{info?.displayName}</p>
            </div>
          </div>

          <h1 className="font-display text-[12vw] sm:text-5xl md:text-7xl font-black uppercase tracking-tight leading-[0.95] text-white drop-shadow-2xl">
            انضم إلى
            <br />
            <span className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] bg-clip-text text-transparent">
              Megsy AI
            </span>
          </h1>

          <p className="mx-auto max-w-md text-base leading-relaxed text-white/70 md:text-lg">
            مساحة عمل واحدة تجمع المحادثة، الصور، الفيديو، الكود، والبحث — مدعومة بأقوى نماذج الذكاء الاصطناعي.
          </p>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { title: "مجاناً", desc: "بدون بطاقة" },
              { title: "كل النماذج", desc: "في مكان واحد" },
              { title: "خصوصية", desc: "بياناتك تخصك" },
            ].map((b) => (
              <div key={b.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur">
                <p className="text-xs font-bold text-white">{b.title}</p>
                <p className="mt-1 text-[10px] text-white/50">{b.desc}</p>
              </div>
            ))}
          </div>

          <button
            onClick={join}
            className="w-full rounded-2xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-8 py-5 text-sm font-black uppercase tracking-[0.2em] text-black shadow-2xl shadow-[#FFA500]/30 transition hover:scale-[1.02]"
          >
            قبول الدعوة
          </button>

          <p dir="ltr" className="text-xs text-white/40">
            CODE · <span className="font-mono text-white/70">{code}</span>
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default ReferralLandingPage;
