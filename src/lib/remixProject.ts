import { supabase } from "@/integrations/supabase/client";

/**
 * Clone an existing user project (in `projects` + `ai_project_files`)
 * into a brand-new project owned by the current user. NO AI calls,
 * zero token usage. Returns the new project id.
 */
export async function cloneUserProject(sourceProjectId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to remix a project.");

  // 1. Fetch the source project (visible rows only — RLS)
  const { data: src, error: srcErr } = await supabase
    .from("projects")
    .select("name, description, files_snapshot, linked_supabase_project_ref, linked_supabase_project_name, linked_supabase_url, publish_settings")
    .eq("id", sourceProjectId)
    .maybeSingle();
  if (srcErr) throw srcErr;
  if (!src) throw new Error("Source project not found.");

  // 2. Fetch all files
  const { data: files, error: filesErr } = await supabase
    .from("ai_project_files")
    .select("path, content")
    .eq("project_id", sourceProjectId);
  if (filesErr) throw filesErr;

  // 3. Insert the new project
  const newName = `${src.name ?? "Untitled"} (copy)`;
  const { data: created, error: insErr } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: newName,
      description: src.description ?? null,
      status: "active",
      visibility: "private",
      files_snapshot: src.files_snapshot ?? null,
      publish_settings: src.publish_settings ?? {},
    })
    .select("id")
    .single();
  if (insErr) throw insErr;

  // 4. Copy file rows
  if (files && files.length > 0) {
    const rows = files.map((f) => ({
      project_id: created.id,
      path: f.path,
      content: f.content,
    }));
    const { error: copyErr } = await supabase
      .from("ai_project_files")
      .insert(rows);
    if (copyErr) throw copyErr;
  }

  return created.id;
}
