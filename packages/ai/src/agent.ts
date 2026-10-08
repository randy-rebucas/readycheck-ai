import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import nodePath from "node:path";
import Anthropic from "@anthropic-ai/sdk";

/**
 * A coding agent that edits a checked-out repository through four file tools
 * and reports back with `finish`. Used for auto-fixes the templates can't
 * cover and for building feature slices. Runs a manual streaming loop so every
 * tool input is validated and every path is confined to the repository root.
 */

export const CODING_MODEL = "claude-opus-5-5";

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", "coverage", "vendor", "__pycache__"]);
const MAX_LIST = 400;
const MAX_READ_BYTES = 120_000;
const MAX_TURNS = 40;

export interface CodingAgentOptions {
  /** Absolute path of the checked-out repository. */
  root: string;
  /** What to build or fix, with all the context the model needs. */
  task: string;
  /** Extra system guidance (house rules for this kind of job). */
  guidance?: string;
  maxTurns?: number;
  apiKey?: string;
  model?: string;
}

export interface CodingAgentResult {
  summary: string;
  /** The agent's own judgement: "high" when the change is mechanical and safe. */
  confidence: "high" | "review";
  /** Repository-relative paths written or deleted. */
  changed: string[];
}

export class CodingAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodingAgentError";
  }
}

const SYSTEM = `You are a senior engineer making a focused change to a repository you have checked out.
Work only through the tools. Explore enough of the codebase to match its conventions (language, framework, formatting, test style) before writing.
Keep the change as small as the task allows; don't reformat or refactor unrelated code. Never write secrets, credentials or real personal data into files.
When the change is complete, call finish with a short summary for the pull request description and your confidence:
"high" only when the change is mechanical and you're certain it builds and behaves; otherwise "review".
If the task can't be done safely, call finish without writing files and explain why in the summary.`;

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "list_files",
    description:
      "List files under a directory of the repository (recursive, skips .git, node_modules and build output). Use '.' for the root.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Directory relative to the repository root." } },
      required: ["path"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "read_file",
    description: "Read a text file of the repository.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "File path relative to the repository root." } },
      required: ["path"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "write_file",
    description: "Create or overwrite a file with the full new contents.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to the repository root." },
        contents: { type: "string", description: "The complete file contents." },
      },
      required: ["path", "contents"],
      additionalProperties: false,
    },
    strict: true,
    // File contents can be long; stream them as they're generated.
    eager_input_streaming: true,
  },
  {
    name: "delete_file",
    description: "Delete a file from the repository.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "File path relative to the repository root." } },
      required: ["path"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "finish",
    description: "Call once when done. Ends the session.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "What changed and why, for the pull request description." },
        confidence: { type: "string", enum: ["high", "review"] },
      },
      required: ["summary", "confidence"],
      additionalProperties: false,
    },
    strict: true,
  },
];

/** Resolves a model-supplied path inside root, or returns null if it escapes it. */
export function confine(root: string, path: string): string | null {
  const target = nodePath.resolve(root, path);
  const relative = nodePath.relative(root, target);
  if (relative.startsWith("..") || nodePath.isAbsolute(relative)) return null;
  // Never let the agent touch git internals.
  if (relative === ".git" || relative.startsWith(`.git${nodePath.sep}`)) return null;
  return target;
}

function listFiles(root: string, dir: string): string[] {
  const out: string[] = [];
  const walk = (abs: string) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (out.length >= MAX_LIST) return;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(nodePath.join(abs, entry.name));
      } else {
        out.push(nodePath.relative(root, nodePath.join(abs, entry.name)).split(nodePath.sep).join("/"));
      }
    }
  };
  walk(dir);
  return out;
}

function str(input: unknown, key: string): string | null {
  const value = (input as Record<string, unknown> | null)?.[key];
  return typeof value === "string" ? value : null;
}

export async function runCodingAgent(options: CodingAgentOptions): Promise<CodingAgentResult> {
  const client = new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {});
  const root = nodePath.resolve(options.root);
  const changed = new Set<string>();
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: options.task }];
  const system = options.guidance ? `${SYSTEM}\n\n${options.guidance}` : SYSTEM;
  let jsonRetries = 0;

  function run(name: string, input: unknown): { content: string; isError?: boolean; finish?: CodingAgentResult } {
    if (name === "finish") {
      const summary = str(input, "summary");
      const confidence = str(input, "confidence");
      if (!summary || (confidence !== "high" && confidence !== "review")) {
        return { content: "finish needs summary and confidence (high|review).", isError: true };
      }
      return { content: "ok", finish: { summary, confidence, changed: [...changed] } };
    }

    const path = str(input, "path");
    if (path === null) return { content: "Missing or invalid 'path'.", isError: true };
    const target = confine(root, path);
    if (!target) return { content: "Path is outside the repository or inside .git.", isError: true };
    const rel = nodePath.relative(root, target).split(nodePath.sep).join("/");

    switch (name) {
      case "list_files": {
        if (!existsSync(target) || !statSync(target).isDirectory()) return { content: "Not a directory.", isError: true };
        const files = listFiles(root, target);
        return { content: files.length ? files.join("\n") + (files.length >= MAX_LIST ? "\n(truncated)" : "") : "(empty)" };
      }
      case "read_file": {
        if (!existsSync(target) || !statSync(target).isFile()) return { content: "File not found.", isError: true };
        const buf = readFileSync(target);
        if (buf.includes(0)) return { content: "Binary file; not shown.", isError: true };
        const text = buf.subarray(0, MAX_READ_BYTES).toString("utf8");
        return { content: buf.length > MAX_READ_BYTES ? `${text}\n(truncated at ${MAX_READ_BYTES} bytes)` : text };
      }
      case "write_file": {
        const contents = str(input, "contents");
        // With eager input streaming the server doesn't validate; a truncated
        // input must not be written as if it were the whole file.
        if (contents === null) return { content: "INVALID_JSON: missing 'contents'.", isError: true };
        mkdirSync(nodePath.dirname(target), { recursive: true });
        writeFileSync(target, contents);
        changed.add(rel);
        return { content: `Wrote ${rel}` };
      }
      case "delete_file": {
        if (!existsSync(target)) return { content: "File not found.", isError: true };
        rmSync(target);
        changed.add(rel);
        return { content: `Deleted ${rel}` };
      }
      default:
        return { content: `Unknown tool ${name}.`, isError: true };
    }
  }

  for (let turn = 0; turn < (options.maxTurns ?? MAX_TURNS); turn++) {
    const stream = client.beta.messages.stream({
      model: options.model ?? CODING_MODEL,
      max_tokens: 64000,
      system,
      tools,
      messages,
      output_config: { effort: "high" },
      // Policy declines are re-run on a suitable fallback model server-side.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // Only an unparseable streamed tool input is retried; API errors propagate.
      if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
      continue;
    }

    if (message.stop_reason === "refusal") {
      throw new CodingAgentError("The model declined this change.");
    }
    if (message.stop_reason === "max_tokens") {
      throw new CodingAgentError("The change was too large to write in one step.");
    }
    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }

    const calls = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    messages.push({ role: "assistant", content: message.content });
    if (calls.length === 0) {
      // Ended without finish: ask for it explicitly rather than guessing.
      messages.push({ role: "user", content: "Call finish with a summary and confidence to end the session." });
      continue;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    let finished: CodingAgentResult | undefined;
    for (const call of calls) {
      const result = run(call.name, call.input);
      results.push({ type: "tool_result", tool_use_id: call.id, content: result.content, is_error: result.isError });
      if (result.finish) finished = result.finish;
    }
    if (finished) return finished;
    messages.push({ role: "user", content: results });
  }

  throw new CodingAgentError("The agent ran out of turns before finishing.");
}

/** One-shot Q&A about a finding, grounded in what the scan found. */
export async function answerAboutFinding(input: {
  question: string;
  finding: string;
  context: string;
  apiKey?: string;
}): Promise<string> {
  const client = new Anthropic(input.apiKey ? { apiKey: input.apiKey } : {});
  const response = await client.beta.messages.create({
    model: CODING_MODEL,
    max_tokens: 16000,
    system:
      "You help developers fix production-readiness findings in their repository. Answer the question about the finding below concretely and briefly, with exact steps or code for the stack described. If you don't know something about their setup, say what to check rather than guessing.",
    messages: [
      { role: "user", content: `Finding:\n${input.finding}\n\nRepository context:\n${input.context}\n\nQuestion: ${input.question}` },
    ],
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  if (response.stop_reason === "refusal") return "The assistant can't help with this question.";
  return response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
