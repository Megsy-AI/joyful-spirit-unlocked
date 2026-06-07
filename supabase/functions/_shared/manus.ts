// supabase/functions/_shared/manus.ts
// Shared Manus API v2 client. Auth: x-manus-api-key header.
// Docs: https://open.manus.ai/docs/v2/

export const MANUS_BASE = "https://api.manus.ai/v2";

export const TIER_TO_PROFILE: Record<string, "manus-1.6" | "manus-1.6-lite" | "manus-1.6-max"> = {
  lite: "manus-1.6-lite",
  smart: "manus-1.6",
  pro: "manus-1.6-max",
  "pro-turbo": "manus-1.6-max",
  max: "manus-1.6-max",
};

export function resolveAgentProfile(tier: string | undefined): "manus-1.6" | "manus-1.6-lite" | "manus-1.6-max" {
  if (!tier) return "manus-1.6";
  return TIER_TO_PROFILE[tier] ?? "manus-1.6";
}

// Get a Manus API key. Tries the rotating pool (api_keys table, service='manus') first,
// then falls back to the MANUS_API_KEY env var. Also exposes the picked row id for
// usage reporting.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _manusAdmin: SupabaseClient | null = null;
function manusAdmin(): SupabaseClient | null {
  if (_manusAdmin) return _manusAdmin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  _manusAdmin = createClient(url, key, { auth: { persistSession: false } });
  return _manusAdmin;
}

async function pickManusKey(): Promise<{ id: string | null; api_key: string }> {
  const admin = manusAdmin();
  if (admin) {
    const { data } = await admin.rpc("pick_api_key", { p_service: "manus" });
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.api_key) return { id: row.id, api_key: row.api_key };
  }
  const env = Deno.env.get("MANUS_API_KEY");
  if (env) return { id: null, api_key: env };
  throw new Error("MANUS_API_KEY_missing");
}

async function reportManusUsage(id: string | null, ok: boolean, status?: number, errMsg?: string) {
  if (!id) return;
  const admin = manusAdmin();
  if (!admin) return;
  await admin.rpc("record_api_key_usage", {
    p_id: id, p_cost_usd: 0, p_ok: ok,
    p_error: errMsg ?? null, p_status_code: status ?? null,
  });
}

// Legacy sync helper kept for back-compat callers.
export function getManusKey(): string {
  const k = Deno.env.get("MANUS_API_KEY");
  if (!k) throw new Error("MANUS_API_KEY_missing");
  return k;
}

export async function manus<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const { id: keyId, api_key: key } = await pickManusKey();
  const url = new URL(`${MANUS_BASE}${path}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: {
      "x-manus-api-key": key,
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let json: unknown = {};
  try { json = JSON.parse(text); } catch { /* keep text */ }
  if (!res.ok) {
    const j = json as { error?: { message?: string; code?: string } };
    const msg = j.error?.message || text.slice(0, 300) || `manus ${res.status}`;
    const code = j.error?.code || "";
    await reportManusUsage(keyId, false, res.status, msg);
    throw new Error(`manus_${res.status}${code ? `_${code}` : ""}: ${msg}`);
  }
  await reportManusUsage(keyId, true, res.status);
  return json as T;
}

// ---------- Task lifecycle ----------

export interface ManusTaskCreateRes {
  ok: true;
  request_id: string;
  task_id: string;
  task_url?: string;
}

type JsonSchemaObject = {
  type?: string;
  enum?: string[];
  properties?: Record<string, JsonSchemaObject>;
};

export async function createTask(opts: {
  prompt: string;
  agent_profile: "manus-1.6" | "manus-1.6-lite" | "manus-1.6-max";
  project_id?: string;
  title?: string;
}): Promise<ManusTaskCreateRes> {
  return await manus<ManusTaskCreateRes>("/task.create", {
    method: "POST",
    body: {
      message: { content: opts.prompt },
      agent_profile: opts.agent_profile,
      ...(opts.project_id ? { project_id: opts.project_id } : {}),
      ...(opts.title ? { title: opts.title } : {}),
      interactive_mode: false,
      hide_in_task_list: false,
      share_visibility: "private",
    },
  });
}

export interface ManusMessageEvent {
  id?: string;
  event_id: string;
  type: string; // "assistant_message" | "status_update" | "user_message" | "tool_call" | ...
  created_at?: string;
  assistant_message?: { content?: string; text?: string };
  user_message?: { content?: string };
  status_update?: {
    agent_status: "running" | "waiting" | "stopped" | "error";
    status_detail?: {
      waiting_for_event_id?: string;
      waiting_for_event_type?: string;
      waiting_description?: string;
      confirm_input_schema?: unknown;
    };
    error_message?: string;
  };
  tool_call?: { name?: string; title?: string; status?: string; description?: string };
  tool_used?: { name?: string; title?: string; status?: string; description?: string };
  // Loose passthrough — Manus may add more fields
  [k: string]: unknown;
}

export interface ManusListMessagesRes {
  ok: true;
  data?: ManusMessageEvent[];
  messages?: ManusMessageEvent[];
  next_cursor?: string | null;
  has_more?: boolean;
}

function inferEventType(evt: Record<string, unknown>): string {
  if (typeof evt.type === "string" && evt.type) return evt.type;
  if (evt.status_update) return "status_update";
  if (evt.assistant_message) return "assistant_message";
  if (evt.user_message) return "user_message";
  if (evt.tool_call) return "tool_call";
  if (evt.tool_used) return "tool_used";
  if (evt.error_message) return "error_message";
  return "unknown";
}

export function getMessageEvents(page: ManusListMessagesRes): ManusMessageEvent[] {
  const items = (page.data ?? page.messages ?? []) as ManusMessageEvent[];
  return items.map((evt, index) => {
    const raw = evt as ManusMessageEvent & Record<string, unknown>;
    return {
      ...raw,
      event_id: raw.event_id || raw.id || `evt-${index}`,
      type: inferEventType(raw),
    } satisfies ManusMessageEvent;
  });
}

export async function listMessages(opts: {
  task_id: string;
  after?: string;     // cursor
  limit?: number;
  order?: "asc" | "desc";
}): Promise<ManusListMessagesRes> {
  return await manus<ManusListMessagesRes>("/task.listMessages", {
    method: "GET",
    query: {
      task_id: opts.task_id,
      after: opts.after,
      limit: opts.limit ?? 50,
      order: opts.order ?? "asc",
    },
  });
}

export async function sendMessage(task_id: string, content: string) {
  return await manus<{ ok: true }>("/task.sendMessage", {
    method: "POST",
    body: { task_id, message: { content } },
  });
}

export async function confirmAction(task_id: string, event_id: string, input: Record<string, unknown>) {
  return await manus<{ ok: true }>("/task.confirmAction", {
    method: "POST",
    body: { task_id, event_id, input },
  });
}

export async function stopTask(task_id: string) {
  return await manus<{ ok: true }>("/task.stop", {
    method: "POST",
    body: { task_id },
  });
}

export async function getTaskDetail(task_id: string) {
  return await manus<{
    ok: true;
    task_id: string;
    status?: string;
    agent_status?: string;
    title?: string;
    task_url?: string;
  }>("/task.detail", {
    method: "GET",
    query: { task_id },
  });
}

// ---------- Website ----------

export interface ManusWebsitePublishRes {
  ok: true;
  website_id: string;
  version_id?: string;
}

export async function publishWebsite(opts: { task_id?: string; website_id?: string; visibility?: "public" | "team" }) {
  return await manus<ManusWebsitePublishRes>("/website.publish", {
    method: "POST",
    body: {
      ...(opts.task_id ? { task_id: opts.task_id } : {}),
      ...(opts.website_id ? { website_id: opts.website_id } : {}),
      visibility: opts.visibility ?? "public",
    },
  });
}

export interface ManusWebsiteStatusRes {
  ok: true;
  website_id?: string;
  publish_status: "unpublished" | "publishing" | "published" | "failed";
  version_id?: string;
  site_urls?: string[];
  visibility?: string;
  title?: string;
}

export async function websiteStatus(opts: { task_id?: string; website_id?: string }) {
  return await manus<ManusWebsiteStatusRes>("/website.status", {
    method: "GET",
    query: {
      ...(opts.task_id ? { task_id: opts.task_id } : {}),
      ...(opts.website_id ? { website_id: opts.website_id } : {}),
    },
  });
}

export async function websiteListCheckpoints(opts: { task_id?: string; website_id?: string }) {
  return await manus<{
    ok: true;
    published_version_id?: string;
    data: Array<{ version_id: string; status?: string; message?: string; created_at?: string }>;
  }>("/website.listCheckpoints", {
    method: "GET",
    query: {
      ...(opts.task_id ? { task_id: opts.task_id } : {}),
      ...(opts.website_id ? { website_id: opts.website_id } : {}),
    },
  });
}

export async function websiteUpdate(opts: { task_id?: string; website_id?: string; title?: string; visibility?: "public" | "team" | "private" }) {
  return await manus<{ ok: true }>("/website.update", {
    method: "POST",
    body: {
      ...(opts.task_id ? { task_id: opts.task_id } : {}),
      ...(opts.website_id ? { website_id: opts.website_id } : {}),
      ...(opts.title !== undefined ? { title: opts.title } : {}),
      ...(opts.visibility ? { visibility: opts.visibility } : {}),
    },
  });
}

// ---------- Helpers ----------

/**
 * Auto-respond to common `waiting` events without human approval.
 * Returns true if it confirmed something.
 */
export async function autoConfirmWaiting(
  task_id: string,
  status_detail: NonNullable<ManusMessageEvent["status_update"]>["status_detail"],
): Promise<boolean> {
  if (!status_detail?.waiting_for_event_id || !status_detail?.waiting_for_event_type) return false;
  const evt = status_detail.waiting_for_event_type;
  const id = status_detail.waiting_for_event_id;

  // Map of known events → default safe inputs
  const map: Record<string, Record<string, unknown>> = {
    needConnectMyBrowser: { action: "skip" },
    deployAction: { accept: true, global_allow: true },
    terminalExecute: { accept: true, always_allow: true },
    webdevRunAction: { accept: true, mode: "speed", visibility: "public" },
    apiHighCreditNotice: { action: "accept" },
    googleCalendarCreate: { accept: true },
    googleCalendarUpdate: { accept: true },
    googleCalendarDelete: { accept: true },
    outlookCalendarCreate: { accept: true },
    outlookCalendarUpdate: { accept: true },
    outlookCalendarDelete: { accept: true },
    gmailSendAction: { accept: true },
    outlookSendMailsAction: { accept: true },
    metaMarketingAction: { accept: true },
    metaMarketingActionResult: { accept: true },
    connectorOauthExpired: { accept: false },
    mapreduceAction: { accept: true },
    videoGenerate: { choice: "standard" },
  };

  const input = map[evt];
  const schema = (status_detail?.confirm_input_schema ?? null) as JsonSchemaObject | null;

  const schemaFallback = (() => {
    const props = schema?.properties;
    if (!props) return null;
    const next: Record<string, unknown> = {};

    if (props.accept?.type === "boolean") next.accept = true;
    if (props.global_allow?.type === "boolean") next.global_allow = true;
    if (props.always_allow?.type === "boolean") next.always_allow = true;

    const actionEnum = props.action?.enum ?? [];
    if (actionEnum.includes("accept")) next.action = "accept";
    else if (actionEnum.includes("skip")) next.action = "skip";

    const choiceEnum = props.choice?.enum ?? [];
    if (choiceEnum.includes("standard")) next.choice = "standard";

    const modeEnum = props.mode?.enum ?? [];
    if (modeEnum.includes("speed")) next.mode = "speed";
    else if (modeEnum.includes("quality")) next.mode = "quality";
    else if (modeEnum.includes("max")) next.mode = "max";

    const visibilityEnum = props.visibility?.enum ?? [];
    if (visibilityEnum.includes("public")) next.visibility = "public";
    else if (visibilityEnum.includes("owner")) next.visibility = "owner";
    else if (visibilityEnum.includes("team")) next.visibility = "team";

    return Object.keys(next).length ? next : null;
  })();

  const resolvedInput = input ?? schemaFallback;
  if (!resolvedInput) return false; // unknown / messageAskUser → caller handles
  try {
    await confirmAction(task_id, id, resolvedInput);
    return true;
  } catch (e) {
    const msg = (e as Error).message;
    if (/failed_precondition/i.test(msg) || /current status:\s*running/i.test(msg)) {
      return true;
    }
    console.warn("[manus] autoConfirm failed", evt, msg);
    return false;
  }
}
