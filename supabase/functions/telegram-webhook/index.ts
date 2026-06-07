// Telegram bot webhook — receives media uploads from admins and stores them as
// templates in `showcase_items`. Reply `/trend` to a media message to toggle
// the trending flag (pinned to the top of the gallery).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImageMagick, initializeImageMagick, MagickFormat } from "https://deno.land/x/imagemagick_deno@0.0.26/mod.ts";

let magickReady: Promise<void> | null = null;
function ensureMagick(): Promise<void> {
  if (!magickReady) magickReady = initializeImageMagick();
  return magickReady;
}

async function convertToWebp(bytes: Uint8Array): Promise<Uint8Array> {
  await ensureMagick();
  return await new Promise<Uint8Array>((resolve, reject) => {
    try {
      ImageMagick.read(bytes, (img) => {
        img.quality = 92;
        img.write(MagickFormat.Webp, (data) => resolve(new Uint8Array(data)));
      });
    } catch (e) { reject(e); }
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const db = createClient(SUPABASE_URL, SERVICE_KEY);

async function tg(method: string, payload: Record<string, unknown>) {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not set");
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}

// Services supported by the rotation pool.
const SERVICES = ["serper", "firecrawl", "leonardo", "manus", "media"] as const;
type Service = typeof SERVICES[number];

const SERVICE_META: Record<Service, { emoji: string; label: string; desc: string }> = {
  serper:    { emoji: "🔍", label: "Serper",    desc: "بحث ويب — يُستخدم في معظم خدمات الموقع" },
  firecrawl: { emoji: "🕷️", label: "Firecrawl", desc: "زحف/استخراج ويب — يُستخدم في معظم خدمات الموقع" },
  manus:     { emoji: "💻", label: "Manus",     desc: "صفحات البرمجة (Megsy Code)" },
  leonardo:  { emoji: "🎨", label: "Leonardo",  desc: "أدوات الصور والفيديو" },
  media:     { emoji: "🎬", label: "Alibaba",   desc: "Alibaba AI — صور وفيديو" },
};

function mainMenu() {
  return {
    inline_keyboard: [
      [{ text: "🔍 Search Keys (Serper / Firecrawl)", callback_data: "cat:search" }],
      [{ text: "💻 Code Keys (Manus)",                callback_data: "cat:code"   }],
      [{ text: "🎨 Media Keys (Leonardo / Alibaba)",  callback_data: "cat:media"  }],
      [{ text: "📋 List All Keys",                    callback_data: "cat:all"    }],
      [
        { text: "🎞 Gallery Templates",              callback_data: "gallery:help" },
        { text: "🖼 Slide Templates",                callback_data: "slides:list:0" },
      ],
      [
        { text: "🧩 Tool Templates",                 callback_data: "tooltpl:list:0" },
        { text: "🌄 Landing Images",                 callback_data: "landing:list:0" },
      ],
      [{ text: "💡 Add Code Prompt",                 callback_data: "codeprompt:add" }],
    ],
  };
}

function categoryMenu(cat: "search" | "code" | "media" | "all") {
  const groups: Record<string, Service[]> = {
    search: ["serper", "firecrawl"],
    code:   ["manus"],
    media:  ["leonardo", "media"],
    all:    [...SERVICES],
  };
  const rows = groups[cat].map((s) => ([
    { text: `${SERVICE_META[s].emoji} ${SERVICE_META[s].label}`, callback_data: `svc:${s}` },
  ]));
  rows.push([{ text: "⬅️ Back", callback_data: "menu:main" }]);
  return { inline_keyboard: rows };
}

async function serviceView(chat_id: number, svc: Service, message_id?: number) {
  const { data: rows } = await db
    .from("api_keys")
    .select("id, label, is_active, is_blocked, block_reason, credit_used_usd, credit_limit_usd, usage_count, error_count")
    .eq("service", svc)
    .order("is_blocked", { ascending: true })
    .order("created_at", { ascending: true });

  const meta = SERVICE_META[svc];
  const list = (rows ?? []);
  const active  = list.filter((r: any) => r.is_active && !r.is_blocked).length;
  const blocked = list.filter((r: any) => r.is_blocked).length;

  const lines: string[] = [
    `${meta.emoji} <b>${meta.label}</b>`,
    `<i>${meta.desc}</i>`,
    "",
    `📦 الإجمالي: <b>${list.length}</b>  ·  ✅ شغّال: <b>${active}</b>  ·  🚫 محظور: <b>${blocked}</b>`,
  ];

  if (list.length) {
    lines.push("");
    for (const r of list as any[]) {
      const status = r.is_blocked ? "🚫" : r.is_active ? "✅" : "⏸️";
      const used = Number(r.credit_used_usd ?? 0).toFixed(3);
      const cap = Number(r.credit_limit_usd ?? 0).toFixed(2);
      const reason = r.is_blocked && r.block_reason ? ` <i>(${r.block_reason})</i>` : "";
      lines.push(`${status} $${used}/$${cap} · ▶ ${r.usage_count} · ⚠ ${r.error_count}${reason}`);
      lines.push(`   <code>${r.id}</code>`);
    }
  } else {
    lines.push("");
    lines.push("لا توجد مفاتيح لهذه الخدمة بعد.");
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: `➕ Add ${meta.label} Key`, callback_data: `addkey:${svc}` }],
  ];
  // Delete buttons (up to 6 most recent to keep keyboard compact)
  for (const r of list.slice(0, 6) as any[]) {
    buttons.push([{ text: `🗑 Delete ${String(r.id).slice(0, 8)}…`, callback_data: `delkey:${r.id}` }]);
  }
  buttons.push([
    { text: "🔄 Refresh", callback_data: `svc:${svc}` },
    { text: "⬅️ Back",    callback_data: "menu:main" },
  ]);

  const text = lines.join("\n");
  if (message_id) {
    await tg("editMessageText", { chat_id, message_id, text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
  } else {
    await tg("sendMessage", { chat_id, text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
  }
}

async function sendMainMenu(chat_id: number, message_id?: number) {
  const text = [
    "🔑 <b>إدارة مفاتيح Megsy</b>",
    "",
    "اختر فئة لإدارة مفاتيحها. كل مفتاح بسقف $5 افتراضياً، والنظام يدوّر تلقائياً ويحظر أي مفتاح يفشل على 401/402/403/429.",
  ].join("\n");
  if (message_id) {
    await tg("editMessageText", { chat_id, message_id, text, parse_mode: "HTML", reply_markup: mainMenu() });
  } else {
    await tg("sendMessage", { chat_id, text, parse_mode: "HTML", reply_markup: mainMenu() });
  }
}

const SLIDES_PAGE_SIZE = 8;

async function sendSlidesPicker(chat_id: number, page: number, message_id?: number) {
  const from = page * SLIDES_PAGE_SIZE;
  const to = from + SLIDES_PAGE_SIZE - 1;
  const { data: rows, count } = await db
    .from("slide_templates")
    .select("template_id, name, image_url", { count: "exact" })
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .range(from, to);

  const total = count ?? 0;
  if (!rows || rows.length === 0) {
    await reply(chat_id, "ℹ️ No slide templates found.");
    return;
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = rows.map((r: any) => {
    const tick = r.image_url ? "✅" : "⬜";
    const label = r.name ?? r.template_id;
    return [{ text: `${tick} ${label}`.slice(0, 60), callback_data: `slides:pick:${r.template_id}`.slice(0, 64) }];
  });

  const nav: Array<{ text: string; callback_data: string }> = [];
  if (page > 0) nav.push({ text: "◀️ Prev", callback_data: `slides:list:${page - 1}` });
  if (from + rows.length < total) nav.push({ text: "Next ▶️", callback_data: `slides:list:${page + 1}` });
  if (nav.length) buttons.push(nav);

  const text = [
    "🖼 <b>Slide Templates</b>",
    `Page ${page + 1} · Total ${total}`,
    "",
    "Pick a template, then send a photo to set its preview image.",
    "(✅ = already has an image)",
  ].join("\n");

  if (message_id) {
    await tg("editMessageText", {
      chat_id, message_id, text, parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    });
  } else {
    await tg("sendMessage", {
      chat_id, text, parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    });
  }
}

const TOOL_TEMPLATES_PAGE_SIZE = 8;
const LANDING_IMAGES_PAGE_SIZE = 8;

function isVideoAssetUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return [".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"].some((ext) => clean.endsWith(ext));
}

async function sendGalleryHelp(chat_id: number, message_id?: number) {
  const text = [
    "🎞 <b>Gallery Templates</b>",
    "",
    "ابعت صورة أو فيديو مع caption علشان يضاف مباشرة لقوالب المعرض.",
    "السطر الأول لو بدأ بـ <code>#</code> بيتسجل كتصنيف، وباقي الكابشن بيتسجل كالوصف.",
    "",
    "مثال:",
    "<code>#Fashion</code>",
    "<code>Luxury campaign shot with soft rim light</code>",
  ].join("\n");

  const reply_markup = {
    inline_keyboard: [
      [
        { text: "🖼 Slide Templates", callback_data: "slides:list:0" },
        { text: "🧩 Tool Templates", callback_data: "tooltpl:list:0" },
      ],
      [{ text: "⬅️ Back", callback_data: "menu:main" }],
    ],
  };

  if (message_id) {
    await tg("editMessageText", { chat_id, message_id, text, parse_mode: "HTML", reply_markup });
  } else {
    await tg("sendMessage", { chat_id, text, parse_mode: "HTML", reply_markup });
  }
}

async function sendToolTemplatesPicker(chat_id: number, page: number, message_id?: number) {
  const from = page * TOOL_TEMPLATES_PAGE_SIZE;
  const to = from + TOOL_TEMPLATES_PAGE_SIZE - 1;
  const { data: rows, count } = await db
    .from("tool_templates")
    .select("id, tool_id, name, preview_url", { count: "exact" })
    .eq("is_active", true)
    .order("tool_id", { ascending: true })
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .range(from, to);

  const total = count ?? 0;
  if (!rows || rows.length === 0) {
    await reply(chat_id, "ℹ️ No tool templates found.");
    return;
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = rows.map((r: any) => {
    const icon = !r.preview_url ? "⬜" : isVideoAssetUrl(r.preview_url) ? "🎬" : "✅";
    const label = `${r.tool_id} · ${r.name ?? "Template"}`;
    return [{ text: `${icon} ${label}`.slice(0, 60), callback_data: `tooltpl:pick:${r.id}` }];
  });

  const nav: Array<{ text: string; callback_data: string }> = [];
  if (page > 0) nav.push({ text: "◀️ Prev", callback_data: `tooltpl:list:${page - 1}` });
  if (from + rows.length < total) nav.push({ text: "Next ▶️", callback_data: `tooltpl:list:${page + 1}` });
  if (nav.length) buttons.push(nav);
  buttons.push([{ text: "⬅️ Back", callback_data: "menu:main" }]);

  const text = [
    "🧩 <b>Tool Templates</b>",
    `Page ${page + 1} · Total ${total}`,
    "",
    "Pick a template, then send a photo to update its preview.",
    "(✅ = has preview · 🎬 = preview URL is video)",
  ].join("\n");

  if (message_id) {
    await tg("editMessageText", { chat_id, message_id, text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
  } else {
    await tg("sendMessage", { chat_id, text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
  }
}

async function sendLandingImagesPicker(chat_id: number, page: number, message_id?: number) {
  const from = page * LANDING_IMAGES_PAGE_SIZE;
  const to = from + LANDING_IMAGES_PAGE_SIZE - 1;
  const { data: rows, count } = await db
    .from("tool_landing_images")
    .select("tool_id, image_url", { count: "exact" })
    .order("tool_id", { ascending: true })
    .range(from, to);

  const total = count ?? 0;
  if (!rows || rows.length === 0) {
    await reply(chat_id, "ℹ️ No landing images found.");
    return;
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = rows.map((r: any) => {
    const icon = r.image_url ? "✅" : "⬜";
    return [{ text: `${icon} ${r.tool_id}`.slice(0, 60), callback_data: `landing:pick:${r.tool_id}`.slice(0, 64) }];
  });

  const nav: Array<{ text: string; callback_data: string }> = [];
  if (page > 0) nav.push({ text: "◀️ Prev", callback_data: `landing:list:${page - 1}` });
  if (from + rows.length < total) nav.push({ text: "Next ▶️", callback_data: `landing:list:${page + 1}` });
  if (nav.length) buttons.push(nav);
  buttons.push([{ text: "⬅️ Back", callback_data: "menu:main" }]);

  const text = [
    "🌄 <b>Tool Landing Images</b>",
    `Page ${page + 1} · Total ${total}`,
    "",
    "Pick a tool, then send a photo to update its landing image.",
    "(✅ = already has image)",
  ].join("\n");

  if (message_id) {
    await tg("editMessageText", { chat_id, message_id, text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
  } else {
    await tg("sendMessage", { chat_id, text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
  }
}

async function uploadTelegramMediaToStorage(
  media_type: "image" | "video",
  media_url: string,
  storagePrefix: string,
  thumbnail_url?: string | null,
): Promise<{ mediaUrl: string; thumbnailUrl: string | null }> {
  let finalMediaUrl = media_url;
  let finalThumbnailUrl = thumbnail_url ?? null;

  if (media_type === "image") {
    const dl = await fetch(media_url);
    if (!dl.ok) throw new Error(`download failed ${dl.status}`);
    const inputBytes = new Uint8Array(await dl.arrayBuffer());
    const webpBytes = await convertToWebp(inputBytes);
    const path = `${storagePrefix}-${Date.now()}.webp`;
    const { error: upErr } = await db.storage
      .from("showcase-media")
      .upload(path, webpBytes, { contentType: "image/webp", upsert: true });
    if (upErr) throw upErr;
    finalMediaUrl = db.storage.from("showcase-media").getPublicUrl(path).data.publicUrl;
  } else {
    const dl = await fetch(media_url);
    if (!dl.ok) throw new Error(`download failed ${dl.status}`);
    const inputBytes = new Uint8Array(await dl.arrayBuffer());
    const ext = media_url.split(".").pop()?.toLowerCase() || "mp4";
    const safeExt = ["mp4", "webm", "mov", "m4v"].includes(ext) ? ext : "mp4";
    const contentType = safeExt === "webm" ? "video/webm" : "video/mp4";
    const path = `${storagePrefix}-${Date.now()}.${safeExt}`;
    const { error: upErr } = await db.storage
      .from("showcase-media")
      .upload(path, inputBytes, { contentType, upsert: true });
    if (upErr) throw upErr;
    finalMediaUrl = db.storage.from("showcase-media").getPublicUrl(path).data.publicUrl;

    if (finalThumbnailUrl) {
      const thumbResponse = await fetch(finalThumbnailUrl);
      if (thumbResponse.ok) {
        const thumbBytes = new Uint8Array(await thumbResponse.arrayBuffer());
        const webpThumb = await convertToWebp(thumbBytes);
        const thumbPath = `${storagePrefix}-${Date.now()}-thumb.webp`;
        const { error: thumbErr } = await db.storage
          .from("showcase-media")
          .upload(thumbPath, webpThumb, { contentType: "image/webp", upsert: true });
        if (!thumbErr) {
          finalThumbnailUrl = db.storage.from("showcase-media").getPublicUrl(thumbPath).data.publicUrl;
        }
      }
    }
  }

  return { mediaUrl: finalMediaUrl, thumbnailUrl: finalThumbnailUrl };
}

async function getFileUrl(file_id: string): Promise<string | null> {
  const res = await tg("getFile", { file_id });
  const path = res?.result?.file_path;
  if (!path) return null;
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${path}`;
}

async function isAdmin(chat_id: number): Promise<boolean> {
  const { data } = await db
    .from("bot_admins")
    .select("id")
    .eq("telegram_chat_id", chat_id)
    .maybeSingle();
  return !!data;
}

async function reply(chat_id: number, text: string, reply_to?: number) {
  await tg("sendMessage", {
    chat_id,
    text,
    reply_to_message_id: reply_to,
    parse_mode: "HTML",
  });
}

// Shared secret for internal admin-notification calls (DB trigger + pg_cron).
const INTERNAL_SECRET = "mgs_notify_7K9pQ2rV4nL8wX3cF6tY1bN5jH0aZ_v1";
const ADMIN_CHAT_ID = "6657246146";

function safeEqual(a: string | null, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function fmtMoney(cents: number): string { return `$${(cents / 100).toFixed(2)}`; }

async function handleAdminNotify(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({} as any));
  const action = body.action ?? "stats";
  try {
    if (action === "signup") {
      const { count: total } = await db.from("profiles").select("*", { count: "exact", head: true });
      const msg = [
        "🎉 <b>مستخدم جديد سجّل</b>",
        "",
        `👤 <b>الاسم:</b> ${body.name ?? "—"}`,
        `📧 <b>الإيميل:</b> <code>${body.email ?? "—"}</code>`,
        `🆔 <code>${body.user_id ?? "—"}</code>`,
        "",
        `📊 <b>إجمالي المستخدمين:</b> ${total ?? "?"}`,
      ].join("\n");
      await tg("sendMessage", { chat_id: ADMIN_CHAT_ID, text: msg, parse_mode: "HTML", disable_web_page_preview: true });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "stats") {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [
        newUsers, totalUsers,
        newMessages, dayMessages,
        newImages, dayImages,
        newSubs, daySubs,
        hourPayments, dayPayments,
      ] = await Promise.all([
        db.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since),
        db.from("profiles").select("*", { count: "exact", head: true }),
        db.from("messages").select("*", { count: "exact", head: true }).gte("created_at", since),
        db.from("messages").select("*", { count: "exact", head: true }).gte("created_at", dayAgo),
        db.from("generation_jobs").select("*", { count: "exact", head: true }).eq("job_type", "image").gte("created_at", since),
        db.from("generation_jobs").select("*", { count: "exact", head: true }).eq("job_type", "image").gte("created_at", dayAgo),
        db.from("subscriptions").select("*", { count: "exact", head: true }).gte("created_at", since),
        db.from("subscriptions").select("*", { count: "exact", head: true }).gte("created_at", dayAgo),
        db.from("subscriptions").select("amount_cents").gte("created_at", since),
        db.from("subscriptions").select("amount_cents").gte("created_at", dayAgo),
      ]);
      const sumCents = (rows: any) => (rows.data ?? []).reduce((a: number, r: any) => a + (r.amount_cents ?? 0), 0);
      const msg = [
        "📈 <b>تقرير الساعة</b>",
        `<i>${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC</i>`,
        "",
        "👥 <b>المستخدمين</b>",
        `   • جدد آخر ساعة: <b>${newUsers.count ?? 0}</b>`,
        `   • إجمالي: <b>${totalUsers.count ?? 0}</b>`,
        "",
        "💬 <b>رسائل الشات</b>",
        `   • آخر ساعة: <b>${newMessages.count ?? 0}</b>`,
        `   • آخر 24 ساعة: <b>${dayMessages.count ?? 0}</b>`,
        "",
        "🎨 <b>توليد الصور</b>",
        `   • آخر ساعة: <b>${newImages.count ?? 0}</b>`,
        `   • آخر 24 ساعة: <b>${dayImages.count ?? 0}</b>`,
        "",
        "💰 <b>الاشتراكات والإيرادات</b>",
        `   • اشتراكات (ساعة): <b>${newSubs.count ?? 0}</b>`,
        `   • اشتراكات (24 ساعة): <b>${daySubs.count ?? 0}</b>`,
        `   • إيراد آخر ساعة: <b>${fmtMoney(sumCents(hourPayments))}</b>`,
        `   • إيراد آخر 24 ساعة: <b>${fmtMoney(sumCents(dayPayments))}</b>`,
      ].join("\n");
      await tg("sendMessage", { chat_id: ADMIN_CHAT_ID, text: msg, parse_mode: "HTML", disable_web_page_preview: true });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("admin-notify error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Internal admin notification path (DB trigger + pg_cron) — must run before
  // parsing as a Telegram update so it doesn't pollute the webhook flow.
  if (safeEqual(req.headers.get("X-Internal-Secret"), INTERNAL_SECRET)) {
    return await handleAdminNotify(req);
  }

  let update: any;
  try { update = await req.json(); } catch { return new Response("bad json", { status: 400 }); }


  // ---- callback_query (inline button taps) ----
  if (update.callback_query) {
    const cq = update.callback_query;
    const cb_chat_id = cq.message?.chat?.id as number;
    const cb_data = String(cq.data ?? "");
    try { await tg("answerCallbackQuery", { callback_query_id: cq.id }); } catch { /* ignore */ }

    // ---- menu navigation ----
    if (cb_chat_id && (cb_data === "menu:main" || cb_data.startsWith("cat:") || cb_data.startsWith("svc:") || cb_data.startsWith("delkey:") || cb_data.startsWith("addkey:") || cb_data === "gallery:help" || cb_data.startsWith("tooltpl:") || cb_data.startsWith("landing:") || cb_data === "codeprompt:add")) {
      if (!(await isAdmin(cb_chat_id))) {
        await reply(cb_chat_id, "⛔ Admins only.");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      if (cb_data === "menu:main") {
        await sendMainMenu(cb_chat_id, cq.message?.message_id);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      if (cb_data.startsWith("cat:")) {
        const cat = cb_data.slice(4) as "search" | "code" | "media" | "all";
        const titles: Record<string, string> = {
          search: "🔍 <b>Search</b> — Serper / Firecrawl",
          code:   "💻 <b>Code</b> — Manus",
          media:  "🎨 <b>Media</b> — Leonardo / Alibaba",
          all:    "📋 <b>All Services</b>",
        };
        await tg("editMessageText", {
          chat_id: cb_chat_id,
          message_id: cq.message?.message_id,
          text: `${titles[cat] ?? cat}\n\nاختر خدمة لإدارة مفاتيحها:`,
          parse_mode: "HTML",
          reply_markup: categoryMenu(cat),
        });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      if (cb_data.startsWith("svc:")) {
        const svc = cb_data.slice(4) as Service;
        if (!SERVICES.includes(svc)) {
          await reply(cb_chat_id, "Unknown service.");
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }
        await serviceView(cb_chat_id, svc, cq.message?.message_id);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      if (cb_data.startsWith("addkey:")) {
        const svc = cb_data.slice(7) as Service;
        if (!SERVICES.includes(svc)) {
          await reply(cb_chat_id, "Unknown service.");
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }
        await db.from("bot_admin_pending").upsert({
          telegram_chat_id: cb_chat_id,
          awaiting_service: svc,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        }, { onConflict: "telegram_chat_id" });
        const meta = SERVICE_META[svc];
        await reply(cb_chat_id, `🔑 ابعت مفتاح <b>${meta.label}</b> دلوقتي في رسالة واحدة.\n<i>${meta.desc}</i>\n(ينتهي بعد 10 دقايق — /cancel للإلغاء)`);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      if (cb_data.startsWith("delkey:")) {
        const id = cb_data.slice(7);
        const { error: delErr } = await db
          .from("api_keys")
          .update({ is_active: false, is_blocked: true, block_reason: "manual_delete" })
          .eq("id", id);
        if (delErr) {
          await reply(cb_chat_id, `❌ ${delErr.message}`);
        } else {
          // Refresh the service view if we know which service
          const { data: row } = await db.from("api_keys").select("service").eq("id", id).maybeSingle();
          if (row?.service && SERVICES.includes(row.service as Service)) {
            await serviceView(cb_chat_id, row.service as Service, cq.message?.message_id);
          } else {
            await reply(cb_chat_id, `🗑️ Disabled <code>${id}</code>`);
          }
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      if (cb_data === "gallery:help") {
        await sendGalleryHelp(cb_chat_id, cq.message?.message_id);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      if (cb_data.startsWith("tooltpl:")) {
        const parts = cb_data.split(":");
        const sub = parts[1];
        if (sub === "list") {
          const page = Math.max(0, parseInt(parts[2] ?? "0", 10) || 0);
          await sendToolTemplatesPicker(cb_chat_id, page, cq.message?.message_id);
        } else if (sub === "pick") {
          const templateId = parts.slice(2).join(":");
          await db.from("bot_admin_pending").upsert({
            telegram_chat_id: cb_chat_id,
            awaiting_service: `tooltpl:${templateId}`,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          }, { onConflict: "telegram_chat_id" });
          await reply(cb_chat_id, `🧩 Send a photo now to set the preview for tool template <code>${templateId}</code>.\n(Expires in 10 minutes — send /cancel to abort.)`);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      if (cb_data.startsWith("landing:")) {
        const parts = cb_data.split(":");
        const sub = parts[1];
        if (sub === "list") {
          const page = Math.max(0, parseInt(parts[2] ?? "0", 10) || 0);
          await sendLandingImagesPicker(cb_chat_id, page, cq.message?.message_id);
        } else if (sub === "pick") {
          const toolId = parts.slice(2).join(":");
          await db.from("bot_admin_pending").upsert({
            telegram_chat_id: cb_chat_id,
            awaiting_service: `landing:${toolId}`,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          }, { onConflict: "telegram_chat_id" });
          await reply(cb_chat_id, `🌄 Send a photo now to set the landing image for <code>${toolId}</code>.\n(Expires in 10 minutes — send /cancel to abort.)`);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      if (cb_data === "codeprompt:add") {
        await db.from("bot_admin_pending").upsert({
          telegram_chat_id: cb_chat_id,
          awaiting_service: "codeprompt",
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        }, { onConflict: "telegram_chat_id" });
        await reply(cb_chat_id, "💡 ابعت صورة أو فيديو، والكابشن نفسه هيكون البرومبت.\n\n(ينتهي بعد 15 دقيقة — /cancel للإلغاء)");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
    }

    if (cb_chat_id && cb_data.startsWith("slides:")) {
      if (!(await isAdmin(cb_chat_id))) {
        await reply(cb_chat_id, "⛔ Admins only.");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      const parts = cb_data.split(":");
      const sub = parts[1];
      if (sub === "list") {
        const page = Math.max(0, parseInt(parts[2] ?? "0", 10) || 0);
        await sendSlidesPicker(cb_chat_id, page, cq.message?.message_id);
      } else if (sub === "pick") {
        const template_id = parts.slice(2).join(":");
        await db.from("bot_admin_pending").upsert({
          telegram_chat_id: cb_chat_id,
          awaiting_service: `slide:${template_id}`,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        }, { onConflict: "telegram_chat_id" });
        await reply(cb_chat_id, `🖼 Send a photo now to set the preview image for <code>${template_id}</code>.\n(Expires in 10 minutes — send /cancel to abort.)`);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }

  const message = update.message ?? update.edited_message ?? update.channel_post;
  const update_id = update.update_id as number;
  if (!message || typeof update_id !== "number") {
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }

  // Idempotency
  const { error: dupErr } = await db
    .from("telegram_processed_updates")
    .insert({ update_id });
  if (dupErr && dupErr.code === "23505") {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), { headers: corsHeaders });
  }

  const chat_id = message.chat?.id as number;
  const text = (message.text ?? message.caption ?? "").trim();

  try {
    // /start — info + main menu
    if (text.startsWith("/start")) {
      await tg("sendMessage", {
        chat_id,
        parse_mode: "HTML",
        text: [
          "👋 <b>Megsy Admin Bot</b>",
          "",
          `Your chat ID: <code>${chat_id}</code>`,
          "",
          "<b>الأوامر:</b>",
          "• /keys — إدارة مفاتيح الـ API",
          "• /templates — إدارة قوالب السلايد/الأدوات/الصور",
          "• /listkeys — قائمة نصية بكل المفاتيح",
          "• /claim — أول واحد يبقى أدمن",
          "• إرسال صورة/فيديو بكابشن → إضافة قالب للمعرض",
          "• Reply /trend أو /untrend أو /delete على وسيط",
        ].join("\n"),
        reply_markup: mainMenu(),
      });
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // /claim — first user becomes admin
    if (text.startsWith("/claim")) {
      const { count } = await db.from("bot_admins").select("*", { count: "exact", head: true });
      if ((count ?? 0) === 0) {
        await db.from("bot_admins").insert({ telegram_chat_id: chat_id });
        await reply(chat_id, "✅ You are now the bot admin.");
      } else {
        await reply(chat_id, "❌ An admin already exists. Ask them to add you.");
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    if (text === "/cancel") {
      await db.from("bot_admin_pending").delete().eq("telegram_chat_id", chat_id);
      await reply(chat_id, "Cancelled.");
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // /keys — main menu
    if (text.startsWith("/keys")) {
      if (!(await isAdmin(chat_id))) {
        await reply(chat_id, "⛔ Admins only.");
      } else {
        await sendMainMenu(chat_id);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    if (text.startsWith("/templates")) {
      if (!(await isAdmin(chat_id))) {
        await reply(chat_id, "⛔ Admins only.");
      } else {
        await sendGalleryHelp(chat_id);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }


    // /listkeys — show the current pool with usage + status
    if (text.startsWith("/listkeys")) {
      if (!(await isAdmin(chat_id))) {
        await reply(chat_id, "⛔ Admins only.");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      const { data: rows } = await db
        .from("api_keys")
        .select("id, service, label, is_active, is_blocked, block_reason, credit_used_usd, credit_limit_usd, usage_count, error_count")
        .order("service", { ascending: true })
        .order("created_at", { ascending: true });
      if (!rows || rows.length === 0) {
        await reply(chat_id, "ℹ️ مفيش مفاتيح ف الجدول. اضغط /keys علشان تضيف.");
      } else {
        const lines = rows.map((r: any) => {
          const status = r.is_blocked ? "🚫 محظور" : r.is_active ? "✅ شغال" : "⏸️ موقوف";
          const used = Number(r.credit_used_usd ?? 0).toFixed(3);
          const cap = Number(r.credit_limit_usd ?? 0).toFixed(2);
          const reason = r.is_blocked && r.block_reason ? ` (${r.block_reason})` : "";
          return `<b>${r.service}</b> · ${status}${reason}\n  💵 $${used}/$${cap} · ▶️ ${r.usage_count} · ⚠️ ${r.error_count}\n  <code>${r.id}</code>`;
        });
        await tg("sendMessage", {
          chat_id, parse_mode: "HTML",
          text: "🔑 <b>مفاتيح الـ API</b>\n\n" + lines.join("\n\n") + "\n\nلحذف مفتاح: <code>/delkey ID</code>",
        });
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // /delkey <id> — block a key manually
    if (text.startsWith("/delkey")) {
      if (!(await isAdmin(chat_id))) {
        await reply(chat_id, "⛔ Admins only.");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      const id = text.replace(/^\/delkey\s*/, "").trim();
      if (!id) {
        await reply(chat_id, "Usage: <code>/delkey &lt;id&gt;</code>");
      } else {
        const { error: delErr } = await db
          .from("api_keys")
          .update({ is_active: false, is_blocked: true, block_reason: "manual_delete" })
          .eq("id", id);
        if (delErr) await reply(chat_id, `❌ ${delErr.message}`);
        else await reply(chat_id, `🗑️ Disabled key <code>${id}</code>`);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // Pending key input handler — must run BEFORE the admin gate would block a non-admin,
    // and BEFORE media handling so a pasted key isn't treated as a caption.
    {
      const { data: pending } = await db
        .from("bot_admin_pending")
        .select("awaiting_service, expires_at")
        .eq("telegram_chat_id", chat_id)
        .maybeSingle();
      if (pending && text && !text.startsWith("/") && SERVICES.includes(pending.awaiting_service as Service) && !message.photo?.length && !message.video && !message.animation && !message.document) {
        if (new Date(pending.expires_at).getTime() < Date.now()) {
          await db.from("bot_admin_pending").delete().eq("telegram_chat_id", chat_id);
          await reply(chat_id, "⏰ Expired. Tap the button again.");
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }
        if (!(await isAdmin(chat_id))) {
          await db.from("bot_admin_pending").delete().eq("telegram_chat_id", chat_id);
        } else {
          const svc = pending.awaiting_service;
          const { data: newId, error: addErr } = await db.rpc("admin_add_api_key", {
            p_service: svc,
            p_key: text,
            p_label: `${svc} (tg:${chat_id})`,
            p_credit_limit: 5,
          });
          await db.from("bot_admin_pending").delete().eq("telegram_chat_id", chat_id);
          // Delete the user's message so the raw key doesn't linger in chat history.
          try { await tg("deleteMessage", { chat_id, message_id: message.message_id }); } catch { /* ignore */ }
          if (addErr) {
            await reply(chat_id, `❌ Failed to add key: ${addErr.message}`);
          } else {
            await reply(chat_id, `✅ Added <b>${svc}</b> key (id <code>${newId}</code>) with $5 credit cap.`);
          }
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }
      }
    }

    const admin = await isAdmin(chat_id);
    if (!admin) {
      await reply(chat_id, `⛔ Not authorized. Your chat id: <code>${chat_id}</code>\nSend /claim if no admins exist.`);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }


    // Reply commands on a media message
    const replied = message.reply_to_message;
    if (replied && (text === "/trend" || text === "/untrend" || text === "/delete")) {
      // Locate the showcase item by stored telegram message id
      const { data: item } = await db
        .from("showcase_items")
        .select("id, is_trending")
        .eq("source", `telegram:${chat_id}:${replied.message_id}`)
        .maybeSingle();
      if (!item) { await reply(chat_id, "Item not found.", message.message_id); return new Response("ok"); }

      if (text === "/delete") {
        await db.from("showcase_items").delete().eq("id", item.id);
        await reply(chat_id, "🗑️ Deleted.", message.message_id);
      } else {
        const next = text === "/trend";
        await db.from("showcase_items").update({
          is_trending: next,
          trending_at: next ? new Date().toISOString() : null,
        }).eq("id", item.id);
        await reply(chat_id, next ? "⭐ Pinned as Trending." : "Unpinned.", message.message_id);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // Media upload — photo or video
    let media_type: "image" | "video" | null = null;
    let file_id: string | null = null;
    let thumb_id: string | null = null;

    if (message.photo?.length) {
      media_type = "image";
      file_id = message.photo[message.photo.length - 1].file_id;
    } else if (message.video) {
      media_type = "video";
      file_id = message.video.file_id;
      thumb_id = message.video.thumb?.file_id ?? null;
    } else if (message.animation) {
      media_type = "video";
      file_id = message.animation.file_id;
      thumb_id = message.animation.thumb?.file_id ?? null;
    } else if (message.document?.mime_type?.startsWith("image/")) {
      media_type = "image";
      file_id = message.document.file_id;
    } else if (message.document?.mime_type?.startsWith("video/")) {
      media_type = "video";
      file_id = message.document.file_id;
      thumb_id = message.document.thumb?.file_id ?? null;
    }

    if (!media_type || !file_id) {
      await reply(chat_id, "Send a photo or video with a caption to add a gallery template, or choose a template target first from /templates.");
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    const media_url = await getFileUrl(file_id);
    if (!media_url) {
      await reply(chat_id, "Could not download the file from Telegram.");
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }
    let thumbnail_url = thumb_id ? await getFileUrl(thumb_id) : null;

    // ---- Slide template image flow ----
    // If admin selected a slide template via the inline picker, route the next
    // photo into slide_templates.image_url instead of showcase_items.
    {
      const { data: pendingTarget } = await db
        .from("bot_admin_pending")
        .select("awaiting_service, expires_at")
        .eq("telegram_chat_id", chat_id)
        .maybeSingle();
      if (pendingTarget?.awaiting_service?.startsWith("slide:") || pendingTarget?.awaiting_service?.startsWith("tooltpl:") || pendingTarget?.awaiting_service?.startsWith("landing:")) {
        if (new Date(pendingTarget.expires_at).getTime() < Date.now()) {
          await db.from("bot_admin_pending").delete().eq("telegram_chat_id", chat_id);
          await reply(chat_id, "⏰ Expired. Tap the button again.", message.message_id);
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }
        if (media_type !== "image") {
          await reply(chat_id, "⚠️ Please send a <b>photo</b> for this selected template target.", message.message_id);
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }
        try {
          const uploaded = await uploadTelegramMediaToStorage("image", media_url, `telegram/admin/${chat_id}/${message.message_id}`);
          const awaiting = pendingTarget.awaiting_service;
          if (awaiting.startsWith("slide:")) {
            const template_id = awaiting.slice("slide:".length);
            const { error: updErr } = await db
              .from("slide_templates")
              .update({ image_url: uploaded.mediaUrl })
              .eq("template_id", template_id);
            if (updErr) throw updErr;
            await reply(chat_id, `✅ Slide template <code>${template_id}</code> image updated.`, message.message_id);
          } else if (awaiting.startsWith("tooltpl:")) {
            const templateId = awaiting.slice("tooltpl:".length);
            const { error: updErr } = await db
              .from("tool_templates")
              .update({ preview_url: uploaded.mediaUrl })
              .eq("id", templateId);
            if (updErr) throw updErr;
            await reply(chat_id, `✅ Tool template <code>${templateId}</code> preview updated.`, message.message_id);
          } else if (awaiting.startsWith("landing:")) {
            const toolId = awaiting.slice("landing:".length);
            const { data: existingRow, error: existingErr } = await db
              .from("tool_landing_images")
              .select("tool_id")
              .eq("tool_id", toolId)
              .maybeSingle();
            if (existingErr) throw existingErr;
            if (existingRow) {
              const { error: updErr } = await db
                .from("tool_landing_images")
                .update({ image_url: uploaded.mediaUrl, updated_at: new Date().toISOString() })
                .eq("tool_id", toolId);
              if (updErr) throw updErr;
            } else {
              const { error: insErr } = await db
                .from("tool_landing_images")
                .insert({ tool_id: toolId, image_url: uploaded.mediaUrl, description: null });
              if (insErr) throw insErr;
            }
            await reply(chat_id, `✅ Landing image updated for <code>${toolId}</code>.`, message.message_id);
          }
          await db.from("bot_admin_pending").delete().eq("telegram_chat_id", chat_id);
        } catch (e) {
          await reply(chat_id, `❌ Failed: ${(e as Error).message}`, message.message_id);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
    }

    // ---- Code Prompt flow ----
    {
      const { data: pendingCp } = await db
        .from("bot_admin_pending")
        .select("awaiting_service, expires_at")
        .eq("telegram_chat_id", chat_id)
        .maybeSingle();
      if (pendingCp?.awaiting_service === "codeprompt") {
        if (new Date(pendingCp.expires_at).getTime() < Date.now()) {
          await db.from("bot_admin_pending").delete().eq("telegram_chat_id", chat_id);
          await reply(chat_id, "⏰ Expired. Tap the button again.", message.message_id);
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }
        const cpPrompt = text.trim();
        if (!cpPrompt) {
          await reply(chat_id, "⚠️ ابعت الميديا مع كابشن فيه البرومبت.", message.message_id);
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }
        try {
          const uploaded = await uploadTelegramMediaToStorage(media_type, media_url, `code-prompts/telegram/${chat_id}/${message.message_id}`, thumbnail_url);
          const { error: cpInsErr } = await db.from("code_prompts").insert({
            title: null,
            prompt: cpPrompt,
            media_url: uploaded.mediaUrl,
            media_type,
            created_by: null,
          });
          if (cpInsErr) throw cpInsErr;
          await db.from("bot_admin_pending").delete().eq("telegram_chat_id", chat_id);
          await reply(chat_id, "✅ تمت إضافة البرومبت.", message.message_id);
        } catch (e) {
          await reply(chat_id, `❌ Failed: ${(e as Error).message}`, message.message_id);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
    }



    // For images: download, convert to WebP, upload to Supabase Storage
    // For videos: download as-is and upload to Storage (Telegram URLs are not permanent)
    let final_media_url = media_url;
    try {
      const uploaded = await uploadTelegramMediaToStorage(media_type, media_url, `telegram/${chat_id}/${message.message_id}`, thumbnail_url);
      final_media_url = uploaded.mediaUrl;
      thumbnail_url = uploaded.thumbnailUrl;
    } catch (e) {
      console.error("telegram media upload failed, falling back to telegram url", e);
    }

    // Parse caption: first line = category (optional, prefixed with #), rest = prompt
    const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
    let category: string | null = null;
    let prompt = text;
    if (lines[0]?.startsWith("#")) {
      category = lines[0].replace(/^#/, "").trim() || null;
      prompt = lines.slice(1).join("\n").trim();
    }

    const { error: insErr } = await db.from("showcase_items").insert({
      media_url: final_media_url,
      media_type,
      thumbnail_url,
      prompt: prompt || "Untitled",
      category: category || "All",
      model_id: "telegram",
      model_name: "Telegram Upload",
      aspect_ratio: "1:1",
      quality: "standard",
      display_order: 0,
      source: `telegram:${chat_id}:${message.message_id}`,
    });

    if (insErr) {
      await reply(chat_id, `❌ Failed: ${insErr.message}`, message.message_id);
    } else {
      await reply(chat_id, "✅ Template added. Reply /trend to pin it.", message.message_id);
    }
  } catch (e) {
    console.error("telegram-webhook error", e);
    try { await reply(chat_id, `Error: ${(e as Error).message}`); } catch {}
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
