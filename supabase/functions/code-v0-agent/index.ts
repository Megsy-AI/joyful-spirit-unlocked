// supabase/functions/code-v0-agent/index.ts
// Manus API v2 backend (drop-in replacement for v0). Keeps the same SSE event
// shape and DB columns the frontend already consumes:
//   - v0_chat_id      ← Manus task_id  (session id)
//   - v0_project_id   ← Manus project_id (optional, unused by default)
//   - v0_latest_version_id ← Manus website version_id
//   - preview_url     ← Manus site_urls[0]  (https://{space_id}.manus.space)
//
// Manus doesn't push streaming SSE — we poll task.listMessages and bridge to SSE.
// EdgeRuntime.waitUntil keeps it alive after client disconnect; code-v0-poll cron
// is the safety net for runs that exceed the edge wall-clock.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { spendCreditsServer, creditErrorResponse } from "../_shared/credits.ts";
import {
  resolveAgentProfile,
  createTask,
  listMessages,
  getMessageEvents,
  sendMessage,
  autoConfirmWaiting,
  publishWebsite,
  websiteStatus,
  type ManusMessageEvent,
} from "../_shared/manus.ts";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
async function userFromRequest(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data } = await sb.auth.getUser();
  return data.user;
}

// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: any;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const encoder = new TextEncoder();

  try {
    const user = await userFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "auth_required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Deno.env.get("MANUS_API_KEY")) {
      return new Response(JSON.stringify({ error: "manus_key_missing", message: "MANUS_API_KEY غير مهيأ في الـ secrets." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { projectId, message, modelTier } = body;
    const tableName: "code_projects" | "projects" =
      body.table === "projects" ? "projects" : "code_projects";
    const ownerCol = tableName === "projects" ? "user_id" : "owner_id";
    if (!projectId || !message) {
      return new Response(JSON.stringify({ error: "projectId and message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = admin();
     const projectSelect = tableName === "projects"
      ? `id, ${ownerCol}, name, v0_chat_id, v0_project_id, model_tier`
      : `id, ${ownerCol}, name, v0_chat_id, v0_project_id, model_tier, instructions`;
     const { data: projectRaw, error: projErr } = await sb.from(tableName)
      .select(projectSelect)
      .eq("id", projectId).maybeSingle();
    if (projErr) {
      return new Response(JSON.stringify({ error: "project_lookup_failed", detail: projErr.message, table: tableName }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!projectRaw) {
      return new Response(JSON.stringify({ error: "project_not_found", projectId, table: tableName }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const project = projectRaw as Record<string, unknown> & {
      id: string;
      name?: string;
      v0_chat_id?: string | null;
      v0_project_id?: string | null;
      model_tier?: string | null;
      instructions?: string | null;
    };
    const ownerId = project[ownerCol] as string | undefined;
    if (ownerId !== user.id) {
      return new Response(JSON.stringify({ error: "forbidden", reason: "not_owner" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tier = modelTier || project.model_tier || "smart";
    const cost = tier === "pro" ? 10 : tier === "lite" ? 3 : 6;
    const spend = await spendCreditsServer(user.id, cost, `code_manus:${tier}`, `Manus generation (${tier})`);
    if (!spend.ok) return creditErrorResponse(spend, corsHeaders);

    const agentProfile = resolveAgentProfile(tier);
    if (modelTier && modelTier !== project.model_tier) {
      await sb.from(tableName).update({ model_tier: modelTier }).eq("id", projectId);
    }

    let taskId: string | null = project.v0_chat_id ?? null;

    const messagesTable = tableName === "projects" ? "ai_project_messages" : "code_messages";
    // (filesTable kept for future use — Manus owns the source files server-side,
    //  so we don't populate it on the client side anymore.)

    // Persist user message + create run + placeholder assistant row
    await sb.from(messagesTable).insert({
      project_id: projectId, role: "user", content: message,
    });

    const { data: runRow } = await sb.from("code_agent_runs").insert({
      project_id: projectId,
      user_id: user.id,
      user_prompt: message,
      status: "running",
      table_name: tableName,
      v0_chat_id: taskId,
    }).select("id").maybeSingle();
    const runId = runRow?.id as string;

    const { data: asstRow } = await sb.from(messagesTable).insert({
      project_id: projectId, role: "assistant", content: "",
    }).select("id").maybeSingle();
    const assistantMessageId = asstRow?.id as string;
    if (runId && assistantMessageId) {
      await sb.from("code_agent_runs")
        .update({ assistant_message_id: assistantMessageId })
        .eq("id", runId);
    }

    // Shared state between SSE stream and waitUntil background processor
    const state = {
      assistantText: "",
      lastPersistAt: 0,
      taskId: taskId as string | null,
      previewUrl: null as string | null,
      versionId: null as string | null,
      tasksByExternal: new Map<string, string>(),
      taskSequence: 0,
      closed: false,
    };

    const persistAssistant = async (force = false) => {
      const now = Date.now();
      if (!force && now - state.lastPersistAt < 1500) return;
      state.lastPersistAt = now;
      if (!assistantMessageId) return;
      await sb.from(messagesTable)
        .update({ content: state.assistantText })
        .eq("id", assistantMessageId);
    };

    const upsertTask = async (
      args: { externalId?: string; title: string; status?: string; detail?: string },
    ) => {
      if (!runId) return;
      const status = args.status || "running";
      const externalId = args.externalId ?? `task-${++state.taskSequence}`;
      const existing = state.tasksByExternal.get(externalId);
      if (existing) {
        await sb.from("code_v0_tasks").update({
          status, title: args.title, detail: args.detail ?? null,
        }).eq("id", existing);
      } else {
        const { data } = await sb.from("code_v0_tasks").insert({
          run_id: runId,
          project_id: projectId,
          external_id: externalId,
          title: args.title,
          status,
          detail: args.detail ?? null,
          sequence: state.taskSequence++,
        }).select("id").maybeSingle();
        if (data?.id) state.tasksByExternal.set(externalId, data.id as string);
      }
    };

    // SSE response stream
    const sseStream = new ReadableStream({
      start(controller) {
        const send = (event: string, data: unknown) => {
          if (state.closed) return;
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch { /* client gone */ }
        };
        const heartbeat = setInterval(() => send("ping", { t: Date.now() }), 15_000);

        const closeStream = () => {
          if (state.closed) return;
          state.closed = true;
          clearInterval(heartbeat);
          try { controller.close(); } catch { /* */ }
        };

        const work = (async () => {
          send("run", { runId });
          send("model", { tier, modelId: agentProfile });
          let agentStatus: "running" | "waiting" | "stopped" | "error" = "running";

          try {
            // 1) Create task or send follow-up
            if (!state.taskId) {
              send("status", { text: "Manus بيبدأ المهمة…" });
              const prompt = project.instructions
                ? `${project.instructions}\n\n---\n\n${message}`
                : message;
              const created = await createTask({
                prompt,
                agent_profile: agentProfile,
                title: project.name || `Megsy ${projectId.slice(0, 8)}`,
              });
              state.taskId = created.task_id;
              await sb.from(tableName).update({ v0_chat_id: state.taskId }).eq("id", projectId);
              if (runId) {
                await sb.from("code_agent_runs")
                  .update({ v0_chat_id: state.taskId })
                  .eq("id", runId);
              }
              send("chat_created", { chatId: state.taskId, webUrl: created.task_url });
            } else {
              send("status", { text: "Manus بيكمل المهمة…" });
              try {
                await sendMessage(state.taskId, message);
              } catch (e) {
                const msg = (e as Error).message;
                if (/manus_404/.test(msg)) {
                  send("status", { text: "المحادثة القديمة غير صالحة — ببدأ مهمة جديدة…" });
                  const prompt = project.instructions
                    ? `${project.instructions}\n\n---\n\n${message}`
                    : message;
                  const created = await createTask({
                    prompt,
                    agent_profile: agentProfile,
                    title: project.name || `Megsy ${projectId.slice(0, 8)}`,
                  });
                  state.taskId = created.task_id;
                  await sb.from(tableName).update({ v0_chat_id: state.taskId }).eq("id", projectId);
                  if (runId) {
                    await sb.from("code_agent_runs")
                      .update({ v0_chat_id: state.taskId })
                      .eq("id", runId);
                  }
                  send("chat_created", { chatId: state.taskId, webUrl: created.task_url, restarted: true });
                } else {
                  throw e;
                }
              }
            }

            // 2) Poll task.listMessages with cursor + dedupe by event_id
            let cursor: string | undefined = undefined;
            const seenEventIds = new Set<string>();
            const startedAt = Date.now();
            const POLL_INTERVAL_MS = 1500;
            const MAX_WALL_MS = 110_000; // leave headroom before edge timeout

            while (agentStatus === "running" || agentStatus === "waiting") {
              if (Date.now() - startedAt > MAX_WALL_MS) {
                send("status", { text: "العملية لسه شغّالة — هتكمل في الخلفية." });
                break;
              }

              let page;
              try {
                page = await listMessages({
                  task_id: state.taskId!,
                  after: cursor,
                  order: "asc",
                  limit: 50,
                });
              } catch (e) {
                console.warn("[code-manus-agent] listMessages error", (e as Error).message);
                await sleep(POLL_INTERVAL_MS);
                continue;
              }

              const events = getMessageEvents(page);
              let newCount = 0;
              for (const evt of events) {
                if (seenEventIds.has(evt.event_id)) continue;
                seenEventIds.add(evt.event_id);
                newCount++;
                await handleEvent(evt);
              }

              // Advance cursor: prefer next_cursor, else use last event_id so we don't loop
              if (page.next_cursor) {
                cursor = page.next_cursor;
              } else if (events.length > 0) {
                cursor = events[events.length - 1].event_id;
              }

              if (newCount === 0) {
                await sleep(POLL_INTERVAL_MS);
              } else {
                await sleep(500);
              }
            }

            // 3) Publish website (if task built one)
            if (agentStatus === "stopped" && state.taskId) {
              try {
                send("status", { text: "Manus بينشر الموقع…" });
                await publishWebsite({ task_id: state.taskId, visibility: "public" });
                // Poll status until published / failed
                const deadline = Date.now() + 60_000;
                while (Date.now() < deadline) {
                  const st = await websiteStatus({ task_id: state.taskId });
                  if (st.publish_status === "published") {
                    if (st.site_urls && st.site_urls[0]) {
                      state.previewUrl = st.site_urls[0];
                    }
                    if (st.version_id) state.versionId = st.version_id;
                    break;
                  }
                  if (st.publish_status === "failed") {
                    send("status", { text: "النشر فشل، بس المهمة اتعملت." });
                    break;
                  }
                  await sleep(2000);
                }
              } catch (e) {
                const msg = (e as Error).message;
                // 404 = task didn't build a website (e.g., research / chat task). That's fine.
                if (!/manus_404/.test(msg)) {
                  console.warn("[code-manus-agent] publish failed", msg);
                }
              }
            }

            // Persist final project state
            const updates: Record<string, unknown> = {};
            if (state.previewUrl) updates.preview_url = state.previewUrl;
            if (state.versionId) updates.v0_latest_version_id = state.versionId;
            if (Object.keys(updates).length) {
              await sb.from(tableName).update(updates).eq("id", projectId);
            }
            if (state.previewUrl) send("preview", { url: state.previewUrl });

            // Mark any still-running tasks done
            if (runId) {
              await sb.from("code_v0_tasks")
                .update({ status: "done" })
                .eq("run_id", runId)
                .neq("status", "done");
            }

            const finalMsg = state.assistantText.trim() || "تم تنفيذ الطلب.";
            state.assistantText = finalMsg;
            await persistAssistant(true);

            if (runId) {
              await sb.from("code_agent_runs").update({
                status: agentStatus === "error" ? "error" : "done",
                finished_at: new Date().toISOString(),
                preview_url: state.previewUrl ?? null,
                v0_version_id: state.versionId ?? null,
                last_poll_at: new Date().toISOString(),
              }).eq("id", runId);
            }

            send("done", {
              files: [],
              previewUrl: state.previewUrl,
              versionId: state.versionId,
              summary: finalMsg,
            });
          } catch (e) {
            const msg = (e as Error).message;
            console.error("[code-manus-agent]", msg);
            if (assistantMessageId) {
              await sb.from(messagesTable)
                .update({ content: `حصل خطأ من Manus: ${msg}` })
                .eq("id", assistantMessageId);
            }
            if (runId) {
              await sb.from("code_agent_runs").update({
                status: "error", error: msg, finished_at: new Date().toISOString(),
              }).eq("id", runId);
            }
            send("error", { message: msg });
          } finally {
            closeStream();
          }

          // ---- Inline event handler (closure over state/send/upsertTask) ----
          async function handleEvent(evt: ManusMessageEvent) {
            const t = evt.type;

            // Assistant text (streaming append OR snapshot — Manus emits whole messages)
            if (t === "assistant_message") {
              const text = evt.assistant_message?.content || evt.assistant_message?.text || "";
              if (text) {
                // Manus delivers full messages, not deltas — concatenate with separator
                const next = state.assistantText
                  ? `${state.assistantText}\n\n${text}`
                  : text;
                state.assistantText = next;
                send("delta", { text: text + "\n\n" });
                await persistAssistant();
              }
              return;
            }

            // Tool / step events → task list
             if (t === "tool_call" || t === "tool_result" || t === "tool_used" || t === "step" || /^tool/i.test(t)) {
               const tool = evt.tool_call || evt.tool_used;
               const title = tool?.title
                 || tool?.name
                || (typeof (evt as Record<string, unknown>).title === "string" ? (evt as Record<string, string>).title : "")
                || "Working…";
               const status = /completed|done|success/i.test(tool?.status || "")
                ? "done"
                 : /failed|error/i.test(tool?.status || "")
                ? "error"
                : "running";
              await upsertTask({
                externalId: evt.event_id,
                title,
                status,
                 detail: tool?.description,
              });
              send("task", { event_id: evt.event_id, title, status });
              return;
            }

            // Status updates
            if (t === "status_update" && evt.status_update) {
              const su = evt.status_update;
              agentStatus = su.agent_status;
              send("status", { state: su.agent_status, detail: su.status_detail });

              if (su.agent_status === "waiting" && su.status_detail) {
                const det = su.status_detail;
                // messageAskUser → can't auto-answer; surface to user & break
                if (det.waiting_for_event_type === "messageAskUser") {
                  state.assistantText += (state.assistantText ? "\n\n" : "")
                    + `❓ Manus بيسأل: ${det.waiting_description || "محتاج إجابة منك"}`;
                  await persistAssistant(true);
                  // Stay running; let the user reply on next turn. Bail out for now.
                  agentStatus = "stopped";
                  return;
                }
                // webdevRequestSecrets → can't auto-resolve safely
                if (det.waiting_for_event_type === "webdevRequestSecrets") {
                  state.assistantText += (state.assistantText ? "\n\n" : "")
                    + `🔑 Manus طلب secrets: ${det.waiting_description || ""}. ضيفهم من إعدادات المشروع.`;
                  await persistAssistant(true);
                  agentStatus = "stopped";
                  return;
                }
                // Auto-confirm everything else with safe defaults
                 const ok = await autoConfirmWaiting(state.taskId!, det);
                if (!ok) {
                  // Unknown event — surface and stop
                  state.assistantText += (state.assistantText ? "\n\n" : "")
                     + `⏸️ Manus مستني تأكيد على: ${det.waiting_for_event_type}${det.waiting_description ? ` — ${det.waiting_description}` : ""}`;
                  await persistAssistant(true);
                  agentStatus = "stopped";
                }
              }

              if (su.agent_status === "error" && su.error_message) {
                state.assistantText += (state.assistantText ? "\n\n" : "")
                  + `❌ ${su.error_message}`;
                await persistAssistant(true);
              }
              return;
            }

            // Unknown / passthrough — emit for debugging
            send(t, evt);
          }
        })();

        // Keep background work alive even if the client disconnects.
        try {
          if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
            EdgeRuntime.waitUntil(work);
          }
        } catch { /* ignore */ }
      },
    });

    return new Response(sseStream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("[code-manus-agent] fatal", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
