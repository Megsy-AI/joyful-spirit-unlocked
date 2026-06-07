import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Copy, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type PromptRow = {
  id: string;
  title: string;
  prompt: string;
  media_url: string;
  media_type: "image" | "video";
  created_by: string | null;
  created_at: string;
};

const PromptsGallery = () => {
  const [items, setItems] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("code_prompts" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) toast.error("Failed to load prompts");
      else setItems((data || []) as unknown as PromptRow[]);
      setLoading(false);
    })();
  }, []);

  const handleCopy = async (p: PromptRow) => {
    try {
      await navigator.clipboard.writeText(p.prompt);
      setCopiedId(p.id);
      toast.success("Prompt copied");
      setTimeout(() => setCopiedId((c) => (c === p.id ? null : c)), 1600);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground">Prompts</h3>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-foreground/15 p-10 text-center text-sm text-muted-foreground">
          No prompts yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.025, 0.4), duration: 0.35 }}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03] transition-all hover:border-foreground/25"
            >
              <div className="relative w-full aspect-[16/10] overflow-hidden bg-foreground/[0.05]">
                {p.media_type === "video" ? (
                  <video
                    src={p.media_url}
                    className="absolute inset-0 w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    autoPlay
                  />
                ) : (
                  <img
                    src={p.media_url}
                    alt={p.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                )}
              </div>
              <div className="flex flex-col gap-3 p-3">
                
                <button
                  onClick={() => handleCopy(p)}
                  className={`w-full h-9 rounded-lg text-[12px] font-semibold transition inline-flex items-center justify-center gap-1.5 ${
                    copiedId === p.id
                      ? "bg-emerald-500 text-white"
                      : "bg-foreground text-background hover:opacity-90"
                  }`}
                >
                  {copiedId === p.id ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PromptsGallery;
