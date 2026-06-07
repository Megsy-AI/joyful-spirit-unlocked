// User-facing API for payment-method approval requests and withdrawal requests.
// On submit, posts to telegram-webhook (internal action) which messages admin
// with approve/reject inline buttons.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_SECRET = "mgs_notify_7K9pQ2rV4nL8wX3cF6tY1bN5jH0aZ_v1";
const TG_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/telegram-webhook`;

const MIN_WITHDRAWAL = 10;
const WITHDRAWALS_PER_MONTH = 2;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function notifyTelegram(action: string, payload: Record<string, unknown>) {
  try {
    await fetch(TG_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch (e) {
    console.error("notifyTelegram failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const op = String(body.op ?? "");

  // Fetch user display info for telegram
  const { data: profile } = await admin
    .from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const userLabel = profile?.display_name || user.email || user.id.slice(0, 8);

  try {
    if (op === "submit_method") {
      const method_type = String(body.method_type ?? "custom"); // bank | custom
      const label = String(body.label ?? "").trim().slice(0, 80);
      const instructions = String(body.instructions ?? "").trim().slice(0, 2000);
      if (!label || !instructions) return json({ error: "label_and_instructions_required" }, 400);

      const { data: inserted, error } = await admin
        .from("user_payment_methods")
        .insert({ user_id: user.id, method_type, label, instructions, status: "pending" })
        .select("id").single();
      if (error) return json({ error: error.message }, 500);

      await notifyTelegram("payment_method_request", {
        id: inserted.id,
        user_id: user.id,
        user_label: userLabel,
        method_type, label, instructions,
      });
      return json({ ok: true, id: inserted.id });
    }

    if (op === "submit_withdrawal") {
      const payment_method_id = String(body.payment_method_id ?? "");
      const payment_address = String(body.payment_address ?? "").trim().slice(0, 500);
      const amount = parseFloat(String(body.amount ?? "0"));

      if (!payment_method_id) return json({ error: "method_required" }, 400);
      if (!payment_address) return json({ error: "address_required" }, 400);
      if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
        return json({ error: `min_${MIN_WITHDRAWAL}` }, 400);
      }

      // Validate approved method belongs to user
      const { data: method } = await admin
        .from("user_payment_methods").select("id, label, status, method_type")
        .eq("id", payment_method_id).eq("user_id", user.id).maybeSingle();
      if (!method || method.status !== "approved") {
        return json({ error: "method_not_approved" }, 400);
      }

      // Twice-per-month limit
      const monthStart = new Date();
      monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
      const { count: usedThisMonth } = await admin
        .from("withdrawal_requests")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .neq("status", "rejected")
        .gte("created_at", monthStart.toISOString());
      if ((usedThisMonth ?? 0) >= WITHDRAWALS_PER_MONTH) {
        return json({ error: "monthly_limit_reached", limit: WITHDRAWALS_PER_MONTH }, 400);
      }

      // Balance check
      const [{ data: earns }, { data: wds }] = await Promise.all([
        admin.from("referral_earnings").select("amount").eq("referrer_id", user.id),
        admin.from("withdrawal_requests").select("amount, status").eq("user_id", user.id),
      ]);
      const totalEarned = (earns ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
      const totalCommitted = (wds ?? []).filter((w: any) => w.status !== "rejected")
        .reduce((s: number, r: any) => s + Number(r.amount), 0);
      const available = totalEarned - totalCommitted;
      if (amount > available) return json({ error: "insufficient_balance", available }, 400);

      const { data: req, error } = await admin
        .from("withdrawal_requests")
        .insert({
          user_id: user.id,
          amount,
          method: method.method_type,
          payment_details: method.label,
          payment_method_id,
          payment_address,
          status: "pending",
        })
        .select("id").single();
      if (error) return json({ error: error.message }, 500);

      await notifyTelegram("withdrawal_request", {
        id: req.id,
        user_id: user.id,
        user_label: userLabel,
        amount,
        method_label: method.label,
        method_type: method.method_type,
        payment_address,
      });
      return json({ ok: true, id: req.id });
    }

    return json({ error: "unknown_op" }, 400);
  } catch (e) {
    console.error("withdrawal-flow error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
