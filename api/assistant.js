// iTech Cambodia — AI website assistant — serverless OpenAI proxy (V2)
// The ONLY place the OpenAI API key is ever used. Set OPENAI_API_KEY as a
// Vercel Environment Variable (Project Settings -> Environment Variables) —
// never commit it, never send it to the browser. The client
// (robot/assistant/chat.js) only ever calls this same-origin endpoint,
// which is also why the site's CSP connect-src doesn't need to allow
// api.openai.com at all.
//
// V2 additions over the original proxy:
//  - Real OpenAI function calling (tools) instead of a hand-rolled JSON
//    reply contract — navigateTo/scrollTo/openContactForm/highlightService.
//  - Streaming (Server-Sent-Events-style chunks) when the client requests
//    it, so the reply appears token-by-token instead of after a multi-
//    second wait. Falls back to a single JSON response otherwise.
//  - Conversation memory: prior turns (from robot/assistant/memory.js) are
//    included as real chat history, capped server-side regardless of what
//    the client sends.
//  - Best-effort in-memory per-IP rate limiting (resets on cold start —
//    see RATE_LIMIT below for the honest limitation).
//  - Structured logging that never logs raw visitor text or the API key.
//
// Vercel Node.js serverless function convention: default-export a handler
// taking (req, res). Picked up automatically under /api/*.js, no build
// step or framework config required.

const ALLOWED_PAGES = ["index.html", "about.html", "services.html", "partners.html", "customers.html", "contact.html"];

const CONFIG = {
  model: process.env.ASSISTANT_MODEL || "gpt-4o-mini",
  maxTokens: Number(process.env.ASSISTANT_MAX_TOKENS) || 220,
  temperature: 0.3,
  maxQueryLen: 300,
  maxContextLen: 6000,
  maxHistoryTurns: 12,
  rateLimit: {
    windowMs: Number(process.env.ASSISTANT_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000,
    max: Number(process.env.ASSISTANT_RATE_LIMIT_MAX) || 20,
  },
};

const SYSTEM_PROMPT = `You are the website assistant embedded in the iTech Cambodia corporate website's robot mascot.
You are NOT a general chatbot. You only help visitors find the right page, section, product, or service on this website.

Rules:
- Answer ONLY using the WEBSITE CONTEXT provided in the user message. Never invent facts, prices, or services not present in it.
- Keep replies to 1-2 short sentences. Friendly, professional, no long explanations.
- If the visitor's question is unrelated to this company's website (general knowledge, coding help, unrelated topics), reply with exactly:
  "I'm here to help you explore this website and answer questions about our company, services, and solutions." and do not call any function.
- Always write your short reply as normal assistant text — never leave it empty, even when you also call a function.
- When you can point the visitor somewhere specific, call the matching function (navigateTo, scrollTo, openContactForm, or highlightService) IN ADDITION to your text reply. Call at most one function per turn.
- "page" and "section" arguments MUST come from the CANDIDATES list in the user message (or be omitted) — never invent a page or section id.
- Use conversation history for context (e.g. "tell me more about that"), but every factual claim must still come from the WEBSITE CONTEXT of the CURRENT turn.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "navigateTo",
      description: "Navigate the visitor to a specific page (and optional in-page section) of the iTech Cambodia website.",
      parameters: {
        type: "object",
        properties: {
          page: { type: "string", enum: ALLOWED_PAGES, description: "The page filename to navigate to." },
          section: { type: "string", description: "Optional section/anchor id on that page to scroll to." },
        },
        required: ["page"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scrollTo",
      description: "Scroll to a section on the page the visitor is currently viewing (no page change).",
      parameters: {
        type: "object",
        properties: { section: { type: "string", description: "The section/anchor id to scroll to." } },
        required: ["section"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "openContactForm",
      description: "Open the contact page and focus the contact form — use when the visitor wants to get in touch, request a quote, or book a consultation.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "highlightService",
      description: "Visually highlight a specific card/service/section to draw the visitor's attention to it without navigating away.",
      parameters: {
        type: "object",
        properties: { section: { type: "string", description: "The section/card id to highlight." } },
        required: ["section"],
      },
    },
  },
];

// ---------- logging (never logs raw visitor content or the API key) ----------
function log(level, message, meta = {}) {
  try {
    console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
      JSON.stringify({ ts: new Date().toISOString(), level, message, ...meta })
    );
  } catch {
    /* logging must never throw */
  }
}

// ---------- best-effort in-memory rate limiting ----------
// Resets whenever Vercel spins up a fresh serverless instance (cold start,
// traffic spike, redeploy) — this slows down casual abuse but is NOT a
// real distributed limit. Upgrade to Vercel KV/Upstash for that.
const hits = new Map(); // ip -> { count, resetAt }
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + CONFIG.rateLimit.windowMs });
    return { limited: false };
  }
  entry.count += 1;
  if (entry.count > CONFIG.rateLimit.max) {
    return { limited: true, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { limited: false };
}
// Periodically forget stale entries so `hits` doesn't grow unbounded on a
// long-lived warm instance.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) if (now > entry.resetAt) hits.delete(ip);
}, 10 * 60 * 1000).unref?.();

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json").end(JSON.stringify(body));
}

function validateRequest(body) {
  if (typeof body?.query !== "string" || !body.query.trim() || body.query.length > CONFIG.maxQueryLen) {
    return "Invalid query.";
  }
  return null;
}

function buildMessages(body) {
  const safeContext = typeof body.context === "string" ? body.context.slice(0, CONFIG.maxContextLen) : "";
  const safeCandidates = Array.isArray(body.candidates)
    ? body.candidates
        .filter((c) => c && ALLOWED_PAGES.includes(c.page))
        .slice(0, 10)
        .map((c) => ({ page: c.page, section: typeof c.section === "string" ? c.section : null }))
    : [];
  const history = Array.isArray(body.history)
    ? body.history
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-CONFIG.maxHistoryTurns)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }))
    : [];

  const userContent = `VISITOR QUESTION:\n${body.query.trim()}\n\nWEBSITE CONTEXT:\n${safeContext}\n\nCANDIDATES:\n${JSON.stringify(safeCandidates)}`;

  return [{ role: "system", content: SYSTEM_PROMPT }, ...history, { role: "user", content: userContent }];
}

const VALID_TOOL_NAMES = new Set(TOOLS.map((t) => t.function.name));

function finalizeAction(name, argsStr) {
  if (!name || !VALID_TOOL_NAMES.has(name)) return null;
  let args = {};
  try {
    args = argsStr ? JSON.parse(argsStr) : {};
  } catch {
    return null;
  }
  if (name === "navigateTo" && !ALLOWED_PAGES.includes(args.page)) return null;
  return { type: name, page: args.page, section: args.section };
}

// ---------- non-streaming path ----------
async function handleNonStreaming(res, apiKey, messages, requestId) {
  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: CONFIG.model,
      temperature: CONFIG.temperature,
      max_tokens: CONFIG.maxTokens,
      tools: TOOLS,
      tool_choice: "auto",
      messages,
    }),
  });

  if (!upstream.ok) {
    log("error", "openai_non_stream_failed", { requestId, status: upstream.status });
    json(res, 502, { error: "Assistant is temporarily unavailable." });
    return;
  }

  const data = await upstream.json();
  const message = data.choices?.[0]?.message || {};
  const toolCall = message.tool_calls?.[0];
  const action = toolCall ? finalizeAction(toolCall.function?.name, toolCall.function?.arguments) : null;
  const reply = message.content || (action ? "Sure, let me take you there." : "");

  json(res, 200, { reply: reply.slice(0, 400), action });
}

// ---------- streaming path (Server-Sent-Events-style, same-origin) ----------
async function handleStreaming(res, apiKey, messages, requestId) {
  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: CONFIG.model,
      temperature: CONFIG.temperature,
      max_tokens: CONFIG.maxTokens,
      tools: TOOLS,
      tool_choice: "auto",
      stream: true,
      messages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    log("error", "openai_stream_failed", { requestId, status: upstream.status });
    json(res, 502, { error: "Assistant is temporarily unavailable." });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const toolAcc = {}; // index -> { name, args }
  let replyText = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep last (possibly partial) line for next chunk

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;

        let evt;
        try {
          evt = JSON.parse(payload);
        } catch {
          continue;
        }
        const delta = evt.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          replyText += delta.content;
          send({ type: "delta", text: delta.content });
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolAcc[idx]) toolAcc[idx] = { name: "", args: "" };
            if (tc.function?.name) toolAcc[idx].name += tc.function.name;
            if (tc.function?.arguments) toolAcc[idx].args += tc.function.arguments;
          }
        }
      }
    }
  } catch (err) {
    log("error", "stream_read_failed", { requestId, message: err?.message });
    send({ type: "error", message: "Connection interrupted." });
    res.end();
    return;
  }

  const first = toolAcc[0];
  const action = first ? finalizeAction(first.name, first.args) : null;
  if (!replyText.trim() && action) send({ type: "delta", text: "Sure, let me take you there." });
  if (action) send({ type: "tool", action });
  send({ type: "done" });
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const requestId = Math.random().toString(36).slice(2, 10);
  const ip = getClientIp(req);

  const limit = checkRateLimit(ip);
  if (limit.limited) {
    log("warn", "rate_limited", { requestId, ip });
    res.setHeader("Retry-After", String(limit.retryAfterSec));
    json(res, 429, { error: "Too many requests — please wait a moment and try again." });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log("error", "missing_api_key", { requestId });
    json(res, 500, { error: "Assistant is not configured yet." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      json(res, 400, { error: "Invalid JSON body." });
      return;
    }
  }
  body = body || {};

  const validationError = validateRequest(body);
  if (validationError) {
    json(res, 400, { error: validationError });
    return;
  }

  const messages = buildMessages(body);
  log("info", "request_start", { requestId, ip, streaming: !!body.stream, queryLen: body.query.length });

  try {
    if (body.stream) {
      await handleStreaming(res, apiKey, messages, requestId);
    } else {
      await handleNonStreaming(res, apiKey, messages, requestId);
    }
  } catch (err) {
    log("error", "handler_exception", { requestId, message: err?.message });
    if (!res.headersSent) {
      json(res, 500, { error: "Assistant is temporarily unavailable." });
    } else {
      try {
        res.end();
      } catch {
        /* response already closing */
      }
    }
  }
}
