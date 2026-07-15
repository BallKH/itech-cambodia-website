// iTech Cambodia — AI website assistant — serverless OpenAI proxy
// The ONLY place the OpenAI API key is ever used. Set OPENAI_API_KEY as a
// Vercel Environment Variable (Project Settings -> Environment Variables) —
// never commit it, never send it to the browser. The client
// (robot/assistant/chat.js) only ever calls this same-origin endpoint,
// which is also why the site's CSP connect-src doesn't need to allow
// api.openai.com at all.
//
// Vercel Node.js serverless function convention: default-export a handler
// taking (req, res). No framework/build step required for this file to be
// picked up — Vercel serves anything under /api/*.js as a function
// automatically, even on an otherwise fully static project.

const ALLOWED_PAGES = ["index.html", "about.html", "services.html", "partners.html", "customers.html", "contact.html"];
const MAX_QUERY_LEN = 300;
const MAX_CONTEXT_LEN = 6000;

const SYSTEM_PROMPT = `You are the website assistant embedded in the iTech Cambodia corporate website's robot mascot.
You are NOT a general chatbot. You only help visitors find the right page, section, product, or service on this website.

Rules:
- Answer ONLY using the WEBSITE CONTEXT provided below. Never invent facts, prices, or services not present in it.
- Keep replies to 1-2 short sentences. Friendly, professional, no long explanations.
- If the visitor's question is unrelated to this company's website (general knowledge, coding help, unrelated topics), reply with exactly:
  "I'm here to help you explore this website and answer questions about our company, services, and solutions." and set "action" to null.
- When the context lets you point the visitor somewhere specific, always set "action" to guide them there.
- "action.page" and "action.section" MUST be chosen from the CANDIDATES list below (or both null) — never invent a page or section id that isn't listed.
- Respond with ONLY compact JSON, no markdown fences, matching exactly:
  {"reply": "string", "action": {"type": "navigate", "page": "string", "section": "string or null"} | null}`;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json").end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
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
  const { query, context, candidates } = body || {};

  if (typeof query !== "string" || !query.trim() || query.length > MAX_QUERY_LEN) {
    json(res, 400, { error: "Invalid query." });
    return;
  }
  const safeContext = typeof context === "string" ? context.slice(0, MAX_CONTEXT_LEN) : "";
  const safeCandidates = Array.isArray(candidates)
    ? candidates
        .filter((c) => c && ALLOWED_PAGES.includes(c.page))
        .slice(0, 8)
        .map((c) => ({ page: c.page, section: typeof c.section === "string" ? c.section : null }))
    : [];

  const userContent = `VISITOR QUESTION:\n${query}\n\nWEBSITE CONTEXT:\n${safeContext}\n\nCANDIDATES:\n${JSON.stringify(safeCandidates)}`;

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 220,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!upstream.ok) {
      json(res, 502, { error: "Assistant is temporarily unavailable." });
      return;
    }

    const data = await upstream.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { reply: raw.slice(0, 300), action: null };
    }

    const action =
      parsed.action && ALLOWED_PAGES.includes(parsed.action.page)
        ? { type: "navigate", page: parsed.action.page, section: parsed.action.section || undefined }
        : null;

    json(res, 200, {
      reply: typeof parsed.reply === "string" ? parsed.reply.slice(0, 400) : "",
      action,
    });
  } catch {
    json(res, 500, { error: "Assistant is temporarily unavailable." });
  }
}
