// Vercel AI SDK powered agent loop for Qwen / DashScope (Alibaba).
//
// Replaces the previous hand-rolled tool-calling loop. We use `streamText`
// from the AI SDK with a stop condition of stepCountIs(50) — the SDK handles
// the whole tool-call → execute → re-prompt cycle for us, and supports real
// streaming of the final answer token-by-token.
//
// We keep emitting the SAME SSE wire format the frontend already consumes
// (`{choices:[{delta:{content}}]}` for text, `{tool_event:...}` for tool
// activity, then `data: [DONE]`) so no UI change is needed.

import { streamText, stepCountIs, tool, jsonSchema, type ModelMessage } from "npm:ai@5.0.196";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@1.0.20";
import { executeTool, type RegistryContext } from "./tool-registry.ts";

const MAX_STEPS = 50;

function enqueueSse(controller: ReadableStreamDefaultController<Uint8Array>, payload: unknown) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
}
function enqueueText(controller: ReadableStreamDefaultController<Uint8Array>, content: string) {
  if (!content) return;
  enqueueSse(controller, { choices: [{ delta: { content } }] });
}
function enqueueDone(controller: ReadableStreamDefaultController<Uint8Array>) {
  controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
}

// Convert the OpenAI-style messages we already build into AI-SDK ModelMessage
// shape. We pass arrays of parts through; for image_url parts we translate to
// AI SDK's `{type:'image', image: URL}` shape.
function toModelMessages(messages: any[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const m of messages) {
    const role = m?.role;
    if (role !== "system" && role !== "user" && role !== "assistant") continue;
    const content = m?.content;
    if (typeof content === "string") {
      out.push({ role, content } as ModelMessage);
      continue;
    }
    if (Array.isArray(content)) {
      const parts: any[] = [];
      for (const p of content) {
        if (!p) continue;
        if (p.type === "text" && typeof p.text === "string") {
          parts.push({ type: "text", text: p.text });
        } else if (p.type === "image_url" && p.image_url?.url) {
          try { parts.push({ type: "image", image: new URL(p.image_url.url) }); }
          catch { parts.push({ type: "text", text: `[image: ${p.image_url.url}]` }); }
        } else if (typeof p.text === "string") {
          parts.push({ type: "text", text: p.text });
        }
      }
      out.push({ role, content: parts.length ? parts : "" } as ModelMessage);
      continue;
    }
    out.push({ role, content: String(content ?? "") } as ModelMessage);
  }
  return out;
}

// Build AI-SDK tool record from the OpenAI-style tool array we already build
// in tool-registry.ts. Each tool's `execute` delegates to executeTool().
function buildAiSdkTools(ctx: RegistryContext, tools: any[]) {
  const record: Record<string, ReturnType<typeof tool>> = {};
  for (const t of tools) {
    const fn = t?.function;
    if (!fn?.name) continue;
    const params = fn.parameters || { type: "object", properties: {} };
    record[fn.name] = tool({
      description: fn.description || "",
      inputSchema: jsonSchema(params),
      execute: async (args: any) => {
        const result = await executeTool(ctx, fn.name, args || {});
        return result.ok ? result.data : { error: result.error };
      },
    });
  }
  return record;
}

export interface AgentLoopOpts {
  ctx: RegistryContext;
  model: string;
  systemPrompt: string;
  messages: any[];
  tools: any[];
  signal?: AbortSignal;
}

export function runOdysseusAgent(opts: AgentLoopOpts): Response {
  const { ctx, model: modelName, systemPrompt, messages, tools, signal } = opts;

  // Detect whether the user's last message actually contains Chinese characters.
  // If not, we'll scrub any Chinese that the model leaks into the reply.
  const lastUser = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") {
        const c = messages[i]?.content;
        if (typeof c === "string") return c;
        if (Array.isArray(c)) return c.map((p: any) => p?.text || "").join(" ");
      }
    }
    return "";
  })();
  const userWroteChinese = /[\u4e00-\u9fff]/.test(lastUser);
  const CJK_RE = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]+/g;

  return new Response(new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const provider = createOpenAICompatible({
          name: "alibaba",
          baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
          headers: { Authorization: `Bearer ${ctx.dashscopeKey}` },
        });

        const sdkTools = buildAiSdkTools(ctx, tools);

        const result = streamText({
          model: provider(modelName),
          system: systemPrompt,
          messages: toModelMessages(messages),
          tools: Object.keys(sdkTools).length > 0 ? sdkTools : undefined,
          stopWhen: stepCountIs(MAX_STEPS),
          temperature: 0.5,
          abortSignal: signal,
        });

        // Stream parts from AI SDK and translate to our SSE wire format.
        let buffer = "";
        const flushClean = (text: string) => {
          if (!text) return;
          const cleaned = userWroteChinese ? text : text.replace(CJK_RE, "");
          if (cleaned) enqueueText(controller, cleaned);
        };
        for await (const part of result.fullStream) {
          if (signal?.aborted) break;
          switch (part.type) {
            case "text-delta": {
              const delta = (part as any).textDelta ?? (part as any).text ?? "";
              if (!delta) break;
              buffer += delta;
              // Flush on word boundary so we don't split CJK sequences mid-char.
              const lastSpace = buffer.lastIndexOf(" ");
              if (lastSpace > 0) {
                flushClean(buffer.slice(0, lastSpace + 1));
                buffer = buffer.slice(lastSpace + 1);
              } else if (buffer.length > 200) {
                flushClean(buffer);
                buffer = "";
              }
              break;
            }
            case "tool-call": {
              const p: any = part;
              enqueueSse(controller, {
                tool_event: { type: "tool_call", name: p.toolName, args: p.input ?? p.args ?? {} },
              });
              break;
            }
            case "tool-result": {
              const p: any = part;
              const out = p.output ?? p.result;
              const ok = !(out && typeof out === "object" && "error" in out);
              enqueueSse(controller, {
                tool_event: { type: "tool_result", name: p.toolName, ok, result: out },
              });
              break;
            }
            case "error": {
              const p: any = part;
              const msg = p.error instanceof Error ? p.error.message : String(p.error ?? "stream_error");
              enqueueSse(controller, { error: msg });
              break;
            }
            default:
              // ignore other parts (reasoning, source, finish, step-start, ...)
              break;
          }
        }
        if (buffer) flushClean(buffer);

        enqueueDone(controller);
        controller.close();
      } catch (err) {
        console.error("[odysseus/agent-loop:ai-sdk]", err);
        enqueueSse(controller, { error: err instanceof Error ? err.message : String(err) });
        enqueueDone(controller);
        controller.close();
      }
    },
  }), {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-anon-fingerprint",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}