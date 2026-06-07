// Odysseus-style unified tool registry for the Megsy chat agent.
// All tool definitions + execution live here so the agent loop stays generic.
//
// First-party tools: web_search, memory_recall, memory_save, skill_lookup.
// Integrations (Pipedream apps) are deferred behind the meta-tools
// `tool_search` and `tool_invoke` to keep the model's context window light
// even when the user has connected 20+ apps.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { buildToolsForApps, resolveRequest, type ToolDef } from "../pipedream-tools.ts";
import { proxyRequest } from "../pipedream-proxy.ts";

const DASHSCOPE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";

export interface RegistryContext {
  dashscopeKey: string;
  userId: string | null;
  isGuest: boolean;
  supabaseUrl: string;
  serviceRoleKey: string;
  connectedAccounts: Array<{ app_slug: string; account_id: string; external_user_id: string | null }>;
  integrationTools: any[];                 // OpenAI-style tool schemas built from PIPEDREAM_TOOLS
  integrationByName: Map<string, ToolDef>;
}

export interface ExecResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

// ── First-party tool SCHEMAS (always eager) ─────────────────────────────────

export function buildFirstPartyTools(ctx: RegistryContext) {
  const tools: any[] = [
    {
      type: "function",
      function: {
        name: "web_search",
        description:
          "Search the live web for fresh information (news, prices, dates, facts you may not know). Returns a concise synthesised answer with inline numeric citations.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Specific search query in the user's language." },
          },
          required: ["query"],
        },
      },
    },
  ];

  if (!ctx.isGuest && ctx.userId) {
    tools.push(
      {
        type: "function",
        function: {
          name: "memory_recall",
          description:
            "Search the user's long-term memory for facts, preferences, or context shared in previous chats. Returns up to 5 matching snippets.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "What to look for (keywords, topic, or question)." },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "memory_save",
          description:
            "Persist a durable fact about the user (name, role, preferences, ongoing projects). Use sparingly, only when the user explicitly shares something worth remembering.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short title for the memory (≤ 80 chars)." },
              summary: { type: "string", description: "The fact itself, written as a single short sentence." },
            },
            required: ["title", "summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "skill_lookup",
          description:
            "Search system + user skills for one whose instructions should guide your reply (e.g. coding style, writing tone, domain workflow).",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Keywords describing the kind of skill you need." },
            },
            required: ["query"],
          },
        },
      },
    );
  }

  // Meta-tools for the deferred integration catalog.
  if (ctx.integrationTools.length > 0) {
    tools.push(
      {
        type: "function",
        function: {
          name: "tool_search",
          description:
            "Find a connector tool by keyword. Use this BEFORE invoking any external tool (Gmail, Slack, Notion, etc.). Optionally filter by `server` (app slug).",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Keywords to match in tool name or description." },
              server: { type: "string", description: "Optional connector slug, e.g. 'gmail' or 'notion'." },
              limit: { type: "number", description: "Max results (default 6, max 12)." },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "tool_invoke",
          description:
            "Run a connector tool by its exact name with a JSON arguments object. Discover names via `tool_search` first.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Exact tool name returned by tool_search." },
              arguments: { type: "object", description: "JSON arguments matching that tool's schema." },
            },
            required: ["name"],
          },
        },
      },
    );
  }

  return tools;
}

// ── Execution ───────────────────────────────────────────────────────────────

export async function executeTool(
  ctx: RegistryContext,
  name: string,
  args: Record<string, any>,
): Promise<ExecResult> {
  try {
    switch (name) {
      case "web_search":         return await execWebSearch(ctx, args);
      case "memory_recall":      return await execMemoryRecall(ctx, args);
      case "memory_save":        return await execMemorySave(ctx, args);
      case "skill_lookup":       return await execSkillLookup(ctx, args);
      case "tool_search":        return execToolSearch(ctx, args);
      case "tool_invoke":        return await execToolInvoke(ctx, args);
      default:
        return await execIntegration(ctx, name, args);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// web_search → uses Qwen-plus with forced native web search as a sub-call.
async function execWebSearch(ctx: RegistryContext, args: Record<string, any>): Promise<ExecResult> {
  const query = String(args?.query || "").trim();
  if (!query) return { ok: false, error: "missing 'query'" };

  const body = {
    model: "qwen-plus",
    stream: false,
    temperature: 0.3,
    max_tokens: 1200,
    enable_search: true,
    search_options: { forced_search: true, enable_source: true, search_strategy: "standard" },
    messages: [
      {
        role: "system",
        content:
          "You are a focused web search assistant. Use live web search and return a concise answer to the user's query with inline numeric citations [1], [2]. End with a short 'Sources:' list (title — url).",
      },
      { role: "user", content: query },
    ],
  };

  const r = await fetch(DASHSCOPE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.dashscopeKey}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return { ok: false, error: `web_search upstream ${r.status}: ${t.slice(0, 200)}` };
  }
  const data = await r.json().catch(() => ({} as any));
  const content = data?.choices?.[0]?.message?.content;
  const text = typeof content === "string"
    ? content
    : Array.isArray(content) ? content.map((p: any) => p?.text || "").join("") : "";
  return { ok: true, data: { answer: text.slice(0, 6000) } };
}

function adminClient(ctx: RegistryContext) {
  return createClient(ctx.supabaseUrl, ctx.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function execMemoryRecall(ctx: RegistryContext, args: Record<string, any>): Promise<ExecResult> {
  if (!ctx.userId) return { ok: false, error: "auth_required" };
  const query = String(args?.query || "").trim();
  if (!query) return { ok: false, error: "missing 'query'" };

  const admin = adminClient(ctx);
  // Simple keyword match across title + summary using ilike OR.
  const safe = query.replace(/[%_,]/g, " ").slice(0, 80);
  const { data, error } = await admin
    .from("user_memory_entries")
    .select("title, summary, scope, created_at")
    .eq("user_id", ctx.userId)
    .or(`title.ilike.%${safe}%,summary.ilike.%${safe}%`)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { matches: data || [] } };
}

async function execMemorySave(ctx: RegistryContext, args: Record<string, any>): Promise<ExecResult> {
  if (!ctx.userId) return { ok: false, error: "auth_required" };
  const title = String(args?.title || "").trim().slice(0, 200);
  const summary = String(args?.summary || "").trim().slice(0, 2000);
  if (!title || !summary) return { ok: false, error: "missing 'title' or 'summary'" };

  const admin = adminClient(ctx);
  const { error } = await admin
    .from("user_memory_entries")
    .insert({ user_id: ctx.userId, title, summary, scope: "chat" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { saved: true } };
}

async function execSkillLookup(ctx: RegistryContext, args: Record<string, any>): Promise<ExecResult> {
  const query = String(args?.query || "").trim();
  if (!query) return { ok: false, error: "missing 'query'" };
  const safe = query.replace(/[%_,]/g, " ").slice(0, 80);

  const admin = adminClient(ctx);
  const [sys, usr] = await Promise.all([
    admin
      .from("system_skills")
      .select("name, description, instructions")
      .eq("is_active", true)
      .or(`name.ilike.%${safe}%,description.ilike.%${safe}%,triggers.cs.{${safe}}`)
      .limit(3),
    ctx.userId
      ? admin
          .from("skills")
          .select("name, description, instructions")
          .eq("user_id", ctx.userId)
          .eq("is_active", true)
          .or(`name.ilike.%${safe}%,description.ilike.%${safe}%`)
          .limit(3)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const results = [
    ...((sys.data || []).map((s: any) => ({ source: "system", ...s }))),
    ...((usr.data || []).map((s: any) => ({ source: "user", ...s }))),
  ].slice(0, 5).map((s: any) => ({
    source: s.source,
    name: s.name,
    description: s.description,
    instructions: String(s.instructions || "").slice(0, 2500),
  }));
  return { ok: true, data: { skills: results } };
}

// tool_search → query the deferred integration catalog.
function execToolSearch(ctx: RegistryContext, args: Record<string, any>): ExecResult {
  const q = String(args?.query || "").toLowerCase();
  const server = String(args?.server || "").toLowerCase();
  const limit = Math.min(Math.max(Number(args?.limit) || 6, 1), 12);

  const all = Array.from(ctx.integrationByName.values());
  const matches = all
    .filter((t) => !server || t.appSlug.toLowerCase() === server)
    .filter((t) => !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    .slice(0, limit)
    .map((t) => ({
      name: t.name,
      server: t.appSlug,
      description: t.description,
      input_schema: t.parameters,
    }));
  return { ok: true, data: { matches } };
}

async function execToolInvoke(ctx: RegistryContext, args: Record<string, any>): Promise<ExecResult> {
  const name = String(args?.name || "");
  const params = args?.arguments && typeof args.arguments === "object" ? args.arguments : {};
  if (!name) return { ok: false, error: "missing 'name'" };
  return await execIntegration(ctx, name, params as Record<string, any>);
}

async function execIntegration(
  ctx: RegistryContext,
  name: string,
  args: Record<string, any>,
): Promise<ExecResult> {
  const def = ctx.integrationByName.get(name);
  if (!def) return { ok: false, error: `unknown_tool:${name}` };
  if (!ctx.userId) return { ok: false, error: "auth_required" };

  const account = ctx.connectedAccounts.find((a) => a.app_slug === def.appSlug);
  if (!account) return { ok: false, error: `not_connected:${def.appSlug}` };

  const req = resolveRequest(def, args);
  const proxied = await proxyRequest({
    externalUserId: account.external_user_id || ctx.userId,
    accountId: account.account_id,
    method: req.method,
    url: req.url,
    body: req.body,
    headers: req.headers,
  });
  if (!proxied.ok) return { ok: false, error: `proxy_${proxied.status}: ${JSON.stringify(proxied.data).slice(0, 500)}` };
  return { ok: true, data: proxied };
}

// Helper: build the integration catalog from connected accounts.
export function buildIntegrationCatalog(
  connectedAccounts: Array<{ app_slug: string; account_id: string; external_user_id: string | null }>,
  disabledSlugs: Set<string>,
) {
  const connectedSlugs = new Set(connectedAccounts.map((a) => a.app_slug));
  const built = buildToolsForApps(connectedSlugs, disabledSlugs);
  return { integrationTools: built.tools, integrationByName: built.defByName };
}