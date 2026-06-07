// supabase/functions/code-v0-poll/index.ts
// Safety net: polls Manus for any code_agent_runs that are still "running"
// after the streaming edge function has died. Runs every minute via pg_cron,
// and is also called by the frontend on demand to refresh the preview URL.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  listMessages,
  getMessageEvents,
  websiteStatus,
  publishWebsite,
  autoConfirmWaiting,
  getTaskDetail,
  type ManusMessageEvent,
} from "../_shared/manus.ts";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function syncRun(sb: ReturnType<typeof admin>, run: {
  id: string; project_id: string; v0_chat_id: string | null;
  table_name: string; assistant_message_id: string | null;
  started_at: string;
}): Promise<{ done: boolean; reason?: string }> {
  const ageMsNoChat = Date.now() - new Date(run.started_at).getTime();
  if (!run.v0_chat_id) {
    if (ageMsNoChat > 5 * 60 * 1000) {
      await sb.from("code_agent_runs").update({
        status: "error",
        error: "no_task_id_timeout",
        finished_at: new Date().toISOString(),
        last_poll_at: new Date().toISOString(),
      }).eq("id", run.id);
      return { done: true, reason: "no_task_id_timeout" };
    }
    return { done: false, reason: "no_task_id" };
  }

  const tableName = run.table_name === "projects" ? "projects" : "code_projects";
  const messagesTable = tableName === "projects" ? "ai_project_messages" : "code_messages";

  // Pull task detail + latest messages (collect assistant content, status)
  let agentStatus: string | undefined;
  let assistantText = "";
  try {
    const detail = await getTaskDetail(run.v0_chat_id);
    agentStatus = detail.agent_status;
  } catch (e) {
    await sb.from("code_agent_runs")
      .update({ last_poll_at: new Date().toISOString() })
      .eq("id", run.id);
    return { done: false, reason: (e as Error).message };
  }

  // Collect assistant_message events (paginate up to ~5 pages)
  let cursor: string | undefined = undefined;
  let pages = 0;
  while (pages < 5) {
    try {
      const page = await listMessages({ task_id: run.v0_chat_id, after: cursor, order: "asc", limit: 50 });
      for (const e of getMessageEvents(page)) {
        if (e.type === "assistant_message") {
          const t = e.assistant_message?.content || e.assistant_message?.text || "";
          if (t) assistantText = assistantText ? `${assistantText}\n\n${t}` : t;
        }
        if (e.type === "status_update" && e.status_update?.agent_status === "waiting" && e.status_update.status_detail) {
          // Try to unblock waiting tasks
          await autoConfirmWaiting(run.v0_chat_id, e.status_update.status_detail);
        }
      }
      if (!page.next_cursor || !page.has_more) break;
      cursor = page.next_cursor;
      pages++;
    } catch {
      break;
    }
  }

  if (assistantText && run.assistant_message_id) {
    await sb.from(messagesTable)
      .update({ content: assistantText })
      .eq("id", run.assistant_message_id);
  }

  // Try to fetch / publish website
  let previewUrl: string | null = null;
  let versionId: string | null = null;
  try {
    const st = await websiteStatus({ task_id: run.v0_chat_id });
    if (st.publish_status === "published" && st.site_urls?.[0]) {
      previewUrl = st.site_urls[0];
      versionId = st.version_id ?? null;
    } else if (st.publish_status === "unpublished" && agentStatus === "stopped") {
      // Agent finished but never published — kick it
      try {
        await publishWebsite({ task_id: run.v0_chat_id, visibility: "public" });
      } catch { /* ignore */ }
    }
  } catch (e) {
    const msg = (e as Error).message;
    if (/web project not found/i.test(msg) || /manus_404/.test(msg)) {
      agentStatus = agentStatus === "stopped" ? "error" : agentStatus;
    }
  }

  // Project updates
  const projectUpdates: Record<string, unknown> = {};
  if (versionId) projectUpdates.v0_latest_version_id = versionId;
  if (previewUrl) projectUpdates.preview_url = previewUrl;
  if (Object.keys(projectUpdates).length) {
    await sb.from(tableName).update(projectUpdates).eq("id", run.project_id);
  }

  const isDone = agentStatus === "stopped" || agentStatus === "error";
  const ageMs = Date.now() - new Date(run.started_at).getTime();
  const stalled = ageMs > 20 * 60 * 1000;

  if (isDone || stalled) {
    const finalStatus = agentStatus === "error" ? "error" : "done";
    await sb.from("code_agent_runs").update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      preview_url: previewUrl,
      v0_version_id: versionId,
      last_poll_at: new Date().toISOString(),
      error: stalled && !isDone ? "stalled_timeout" : null,
    }).eq("id", run.id);
    await sb.from("code_v0_tasks")
      .update({ status: "done" })
      .eq("run_id", run.id)
      .neq("status", "done");
    return { done: true, reason: stalled && !isDone ? "stalled" : (agentStatus || "done") };
  }

  await sb.from("code_agent_runs")
    .update({ last_poll_at: new Date().toISOString() })
    .eq("id", run.id);
  return { done: false, reason: agentStatus || "running" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = admin();
    let runId: string | undefined;
    let refreshProjectId: string | undefined;
    let refreshTable: string | undefined;
    try {
      const body = await req.json();
      runId = body?.runId;
      refreshProjectId = body?.projectId;
      refreshTable = body?.table;
    } catch { /* no body = poll all */ }

    // --- On-demand preview-URL refresh.
    // Manus sites at *.manus.space are CDN-cached and persist, so unlike v0
    // the URL doesn't expire. We just re-read website.status to surface the
    // newest checkpoint URL.
    if (refreshProjectId) {
      const tableName = refreshTable === "code_projects" ? "code_projects" : "projects";
      const ownerCol = tableName === "code_projects" ? "owner_id" : "user_id";
      const { data: project } = await sb
        .from(tableName)
        .select(`id, ${ownerCol}, v0_chat_id, preview_url`)
        .eq("id", refreshProjectId)
        .maybeSingle();
      if (!project) {
        return new Response(JSON.stringify({ url: null, refreshed: false, error: "not_found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // deno-lint-ignore no-explicit-any
      const taskId = (project as any).v0_chat_id as string | null;
      // deno-lint-ignore no-explicit-any
      const currentUrl = (project as any).preview_url as string | null;
      if (!taskId) {
        return new Response(JSON.stringify({ url: currentUrl, refreshed: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const st = await websiteStatus({ task_id: taskId });
        const fresh = st.publish_status === "published" ? (st.site_urls?.[0] ?? null) : null;
        if (fresh) {
          await sb.from(tableName).update({ preview_url: fresh }).eq("id", refreshProjectId);
          return new Response(JSON.stringify({ url: fresh, refreshed: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ url: currentUrl, refreshed: false, warning: `publish_status:${st.publish_status}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ url: currentUrl, refreshed: false, warning: (e as Error).message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let runs: Array<{
      id: string; project_id: string; v0_chat_id: string | null;
      table_name: string; assistant_message_id: string | null; started_at: string;
    }>;
    if (runId) {
      const { data } = await sb.from("code_agent_runs")
        .select("id, project_id, v0_chat_id, table_name, assistant_message_id, started_at")
        .eq("id", runId).maybeSingle();
      runs = data ? [data as typeof runs[number]] : [];
    } else {
      const cutoff = new Date(Date.now() - 20_000).toISOString();
      const { data } = await sb.from("code_agent_runs")
        .select("id, project_id, v0_chat_id, table_name, assistant_message_id, started_at")
        .eq("status", "running")
        .or(`last_poll_at.is.null,last_poll_at.lt.${cutoff}`)
        .limit(20);
      runs = (data ?? []) as typeof runs;
    }

    const results: Array<{ id: string; done: boolean; reason?: string }> = [];
    for (const r of runs) {
      try {
        const out = await syncRun(sb, r);
        results.push({ id: r.id, ...out });
      } catch (e) {
        results.push({ id: r.id, done: false, reason: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ polled: runs.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
