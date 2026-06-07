// supabase/functions/code-v0-manage/index.ts
// Management operations for Manus-backed code projects:
//   - get-versions:      list website checkpoints
//   - restore-version:   ask the Manus agent (via task.sendMessage) to revert
//   - deploy:            publish the latest website checkpoint
//   - save-instructions: update project-level instructions (re-sent with each new task)
//   - connect-supabase:  no-op for Manus (sites are sandboxed; pass via prompt instead)

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  publishWebsite,
  websiteStatus,
  websiteListCheckpoints,
  sendMessage,
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: "auth_required" }, 401);

    if (!Deno.env.get("MANUS_API_KEY")) {
      return json({ error: "manus_key_missing" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const { action, projectId } = body as { action?: string; projectId?: string };
    if (!action || !projectId) return json({ error: "action and projectId required" }, 400);

    const sb = admin();
    const { data: project } = await sb.from("code_projects")
      .select("id, owner_id, name, v0_chat_id, v0_project_id, v0_latest_version_id, instructions")
      .eq("id", projectId).maybeSingle();
    if (!project || project.owner_id !== user.id) return json({ error: "forbidden" }, 403);

    // --------------- save-instructions ---------------
    if (action === "save-instructions") {
      const { instructions } = body as { instructions?: string };
      const text = (instructions || "").slice(0, 8000);
      await sb.from("code_projects").update({ instructions: text }).eq("id", projectId);
      return json({ ok: true });
    }

    // --------------- get-versions ---------------
    if (action === "get-versions") {
      if (!project.v0_chat_id) return json({ versions: [] });
      try {
        const data = await websiteListCheckpoints({ task_id: project.v0_chat_id });
        const versions = (data.data || []).map((c) => ({
          id: c.version_id,
          status: c.status,
          message: c.message,
          createdAt: c.created_at,
        }));
        return json({ versions, currentVersionId: data.published_version_id ?? project.v0_latest_version_id });
      } catch (e) {
        // 404 = no website yet
        if (/manus_404/.test((e as Error).message)) return json({ versions: [] });
        return json({ error: (e as Error).message }, 500);
      }
    }

    // --------------- restore-version ---------------
    // Manus has no direct restore-checkpoint endpoint — we ask the agent to
    // revert in plain language. The next streaming run will pick it up.
    if (action === "restore-version") {
      const { versionId } = body as { versionId?: string };
      if (!versionId) return json({ error: "versionId required" }, 400);
      if (!project.v0_chat_id) return json({ error: "no_task" }, 400);
      try {
        await sendMessage(
          project.v0_chat_id,
          `Please revert the website to checkpoint version ${versionId}.`,
        );
        return json({ ok: true, queued: true, versionId });
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }
    }

    // --------------- deploy ---------------
    if (action === "deploy") {
      if (!project.v0_chat_id) return json({ error: "no_task_yet" }, 400);

      const { data: depRow } = await sb.from("code_project_deployments").insert({
        project_id: projectId,
        user_id: user.id,
        v0_chat_id: project.v0_chat_id,
        v0_version_id: project.v0_latest_version_id,
        status: "pending",
      }).select("id").maybeSingle();

      try {
        const pub = await publishWebsite({ task_id: project.v0_chat_id, visibility: "public" });
        // Poll status up to 60s
        let url: string | null = null;
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
          const st = await websiteStatus({ task_id: project.v0_chat_id });
          if (st.publish_status === "published") {
            url = st.site_urls?.[0] ?? null;
            break;
          }
          if (st.publish_status === "failed") break;
          await sleep(2000);
        }
        await sb.from("code_project_deployments").update({
          v0_deployment_id: pub.website_id ?? null,
          url,
          inspector_url: null,
          status: url ? "succeeded" : "failed",
        }).eq("id", depRow!.id);
        if (url) {
          await sb.from("code_projects").update({
            published_url: url,
            preview_url: url,
            v0_latest_version_id: pub.version_id ?? project.v0_latest_version_id,
          }).eq("id", projectId);
        }
        return json({ ok: !!url, url, deploymentId: pub.website_id ?? null });
      } catch (e) {
        const msg = (e as Error).message;
        await sb.from("code_project_deployments").update({ status: "failed", error: msg }).eq("id", depRow!.id);
        return json({ error: msg }, 500);
      }
    }

    // --------------- connect-supabase ---------------
    // Manus sandboxes don't expose project-level env vars via API. The best
    // we can do is inject the keys into the next prompt; the user can also
    // paste them into the Manus webapp manually. Return a hint string.
    if (action === "connect-supabase") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
      if (!supabaseUrl || !anonKey) return json({ error: "supabase_env_missing" }, 500);
      if (!project.v0_chat_id) return json({ error: "no_task_yet", hint: "Start a generation first." }, 400);
      try {
        await sendMessage(
          project.v0_chat_id,
          `Please configure these environment variables for the web app:\n\n` +
          `VITE_SUPABASE_URL=${supabaseUrl}\n` +
          `VITE_SUPABASE_PUBLISHABLE_KEY=${anonKey}\n\n` +
          `Use them when calling Supabase from the frontend.`,
        );
        return json({ ok: true, queued: true });
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[code-manus-manage] fatal", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
