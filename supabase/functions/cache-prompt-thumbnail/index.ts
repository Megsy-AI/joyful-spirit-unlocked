// Caches a screenshot of a prompt's preview URL into Supabase Storage,
// so the image is generated once and served forever from our own CDN.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "prompt-thumbs";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { slug, target_url } = await req.json();
    if (!slug || !target_url || typeof slug !== "string" || typeof target_url !== "string") {
      return json({ error: "Missing slug or target_url" }, 400);
    }

    const safeSlug = slug.replace(/[^a-z0-9-_]/gi, "").slice(0, 120);
    if (!safeSlug) return json({ error: "Invalid slug" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Already cached?
    const existing = await supabase
      .from("prompt_thumbnails")
      .select("image_url")
      .eq("slug", safeSlug)
      .maybeSingle();
    if (existing.data?.image_url) {
      return json({ image_url: existing.data.image_url, cached: true });
    }

    // Generate via thum.io (free, no auth, fast, reliable for public URLs)
    const shotUrl =
      `https://image.thum.io/get/width/1200/crop/750/noanimate/${target_url}`;
    const shotRes = await fetch(shotUrl);
    if (!shotRes.ok) {
      return json({ error: `Screenshot failed: ${shotRes.status}` }, 502);
    }
    const buf = new Uint8Array(await shotRes.arrayBuffer());
    if (buf.byteLength < 1000) {
      return json({ error: "Screenshot too small" }, 502);
    }

    const path = `${safeSlug}.jpg`;
    const up = await supabase.storage.from(BUCKET).upload(path, buf, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (up.error) return json({ error: up.error.message }, 500);

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const image_url = pub.publicUrl;

    await supabase
      .from("prompt_thumbnails")
      .upsert({ slug: safeSlug, image_url }, { onConflict: "slug" });

    return json({ image_url, cached: false });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
