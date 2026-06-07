import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Gift, Zap, Shield, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import LiveAurora from "@/components/referral/LiveAurora";

interface RefInfo {
  displayName: string;
  avatarUrl: string | null;
}

const Glass = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={
      "relative rounded-[28px] border border-white/12 bg-white/[0.06] " +
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_30px_60px_-30px_rgba(0,0,0,0.6)] " +
      "backdrop-blur-2xl backdrop-saturate-150 " +
      className
    }
  >
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[28px] opacity-70"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 35%, rgba(255,255,255,0) 65%, rgba(255,255,255,0.04) 100%)",
      }}
    />
    <div className="relative">{children}</div>
  </div>
);

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
          setInfo({
            displayName: profile?.display_name || "A friend",
            avatarUrl: profile?.avatar_url || null,
          });
        } else {
          setInfo({ displayName: "A friend", avatarUrl: null });
        }
      } catch {
        setInfo({ displayName: "A friend", avatarUrl: null });
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  const handleJoin = () => { if (code) navigate(`/ref/${code}`); };

  if (loading) {
    return (
      <>
        <LiveAurora tone="rose" />
        <div className="flex min-h-[100dvh] items-center justify-center">
          <p className="text-sm text-white/60">Loading…</p>
        </div>
      </>
    );
  }

  const initials = (info?.displayName || "A").charAt(0).toUpperCase();

  return (
    <>
      <LiveAurora tone="rose" />
      <div className="min-h-[100dvh] overflow-y-auto">
        <div className="mx-auto max-w-xl px-4 py-10 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            {/* Inviter glass card */}
            <Glass className="overflow-hidden p-6 text-center md:p-8">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85 backdrop-blur-xl">
                <Sparkles className="h-3 w-3" /> Personal invitation
              </span>

              <div className="mt-5 flex flex-col items-center gap-3">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.1 }}
                  className="relative"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-full blur-2xl"
                    style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.45), transparent 70%)" }}
                  />
                  {info?.avatarUrl ? (
                    <img
                      src={info.avatarUrl}
                      alt={info.displayName}
                      className="h-24 w-24 rounded-full object-cover ring-2 ring-white/30"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-white/15 text-3xl font-semibold text-white backdrop-blur-xl">
                      {initials}
                    </div>
                  )}
                </motion.div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">You're invited by</p>
                  <p className="mt-1 text-[22px] font-semibold tracking-tight text-white">
                    {info?.displayName}
                  </p>
                </div>
              </div>
            </Glass>

            {/* Hero */}
            <div className="px-2 text-center">
              <h1 className="text-[40px] md:text-[56px] font-semibold leading-[1.05] tracking-[-0.025em] text-white">
                Join{" "}
                <span className="bg-gradient-to-r from-white via-white/80 to-white/50 bg-clip-text text-transparent">
                  Megsy AI
                </span>
                <br />today.
              </h1>
              <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/65">
                The all-in-one AI workspace — chat, image, video, code & research in one place.
              </p>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { icon: Gift, title: "Free to start", desc: "No card needed" },
                { icon: Zap, title: "All models", desc: "Chat · image · video · code" },
                { icon: Shield, title: "Private", desc: "Your data, your control" },
              ].map((b, i) => (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.07 }}
                >
                  <Glass className="p-5 text-center">
                    <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl">
                      <b.icon className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-[13px] font-semibold text-white">{b.title}</p>
                    <p className="mt-1 text-[11px] text-white/55">{b.desc}</p>
                  </Glass>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="space-y-3"
            >
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleJoin}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-[15px] font-semibold text-black shadow-[0_18px_40px_-12px_rgba(255,255,255,0.55)] transition-all hover:shadow-[0_22px_50px_-12px_rgba(255,255,255,0.75)]"
              >
                Accept invitation
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </motion.button>
              <p className="text-center text-[11px] text-white/55">
                Code: <span className="font-mono text-white/85">{code}</span>
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default ReferralLandingPage;
