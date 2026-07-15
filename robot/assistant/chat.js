// iTech Cambodia — AI website assistant — orchestrator (V2)
// Pipeline: visitor query -> automatic TF-IDF search over the website
// index -> if nothing relevant, decline locally (no API call) -> else send
// ONLY the top few matching sections + recent conversation history to
// /api/assistant (a same-origin serverless proxy — the OpenAI key never
// reaches the browser, see api/assistant.js) -> stream the reply as it
// arrives, run whatever function call the model decided on, and remember
// the turn for the rest of this visitor session.

import { ASSISTANT_CONFIG } from "./assistant-config.js";
import { getIndex } from "./website-index.js";
import { search } from "./search.js";
import { buildContext, buildCandidates, isOutOfScope } from "./knowledge.js";
import { runAction, actionFromSearchResult } from "./actions.js";
import { getHistory, pushTurn } from "./memory.js";
import { logger } from "./logger.js";

const OUT_OF_SCOPE_REPLY =
  "I'm here to help you explore this website and answer questions about our company, services, and solutions.";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callAssistant(payload, { onDelta } = {}) {
  const { endpoint, streaming, fetchTimeoutMs, retryCount, retryDelayMs } = ASSISTANT_CONFIG.api;
  let lastErr;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, stream: streaming }),
        },
        fetchTimeoutMs
      );
      if (res.status === 429) {
        return { reply: "I'm getting a lot of questions right now — please try again in a moment.", action: null };
      }
      if (!res.ok) throw new Error(`assistant ${res.status}`);

      if (streaming && res.body) {
        return await consumeStream(res.body, onDelta);
      }
      const data = await res.json();
      onDelta?.(data.reply || "");
      return { reply: data.reply || "", action: data.action || null };
    } catch (err) {
      lastErr = err;
      logger.warn("assistant call failed", attempt, err?.message);
      if (attempt < retryCount) await sleep(retryDelayMs);
    }
  }
  throw lastErr;
}

async function consumeStream(body, onDelta) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  let action = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;
      let evt;
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }
      if (evt.type === "delta" && evt.text) {
        reply += evt.text;
        onDelta?.(reply);
      } else if (evt.type === "tool" && evt.action) {
        action = evt.action;
      } else if (evt.type === "error") {
        throw new Error(evt.message || "stream error");
      }
    }
  }
  return { reply, action };
}

/**
 * @param {string} query
 * @param {{onDelta?: (partialReply: string) => void}} [opts] onDelta fires
 *   repeatedly with the growing reply text as it streams in.
 */
export async function ask(query, opts = {}) {
  const trimmed = (query || "").trim().slice(0, ASSISTANT_CONFIG.query.maxLength);
  if (!trimmed) return { reply: "", action: null };

  let index;
  try {
    index = await getIndex();
  } catch (err) {
    logger.error("index load failed", err);
    return { reply: "I couldn't load the site index just now — please try again in a moment.", action: null };
  }

  const results = search(trimmed, index);

  if (isOutOfScope(results)) {
    pushTurn("user", trimmed);
    pushTurn("assistant", OUT_OF_SCOPE_REPLY);
    opts.onDelta?.(OUT_OF_SCOPE_REPLY);
    return { reply: OUT_OF_SCOPE_REPLY, action: null };
  }

  let result;
  try {
    result = await callAssistant(
      {
        query: trimmed,
        context: buildContext(results),
        candidates: buildCandidates(results),
        history: getHistory(),
      },
      opts
    );
  } catch (err) {
    logger.error("assistant unavailable, degrading to search-only navigation", err);
    const action = actionFromSearchResult(results[0]);
    runAction(action);
    const reply = `Here's what I found for "${trimmed}" — taking you there now.`;
    pushTurn("user", trimmed);
    pushTurn("assistant", reply);
    return { reply, action };
  }

  runAction(result.action);
  pushTurn("user", trimmed);
  pushTurn("assistant", result.reply || OUT_OF_SCOPE_REPLY);
  return { reply: result.reply || OUT_OF_SCOPE_REPLY, action: result.action };
}
