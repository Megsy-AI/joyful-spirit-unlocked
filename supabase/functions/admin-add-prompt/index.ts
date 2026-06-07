import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const form = await req.formData();
    const file = form.get("file") as File;
    const prompt = String(form.get("prompt") || "");
    const mediaType = String(form.get("media_type") || "video");
    if (!file || !prompt) return new Response("missing", { status: 400, headers: cors });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ext = mediaType === "video" ? "mp4" : "jpg";
    const key = `code-prompts/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const up = await supabase.storage.from("showcase-media").upload(key, bytes, {
      contentType: file.type || (mediaType === "video" ? "video/mp4" : "image/jpeg"),
      upsert: false,
    });
    if (up.error) return new Response(JSON.stringify(up.error), { status: 500, headers: cors });

    const { data: pub } = supabase.storage.from("showcase-media").getPublicUrl(key);
    const ins = await supabase.from("code_prompts").insert({
      prompt,
      media_url: pub.publicUrl,
      media_type: mediaType,
      title: null,
      created_by: null,
    }).select().single();
    if (ins.error) return new Response(JSON.stringify(ins.error), { status: 500, headers: cors });
    return new Response(JSON.stringify(ins.data), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(String(e), { status: 500, headers: cors });
  }
});
