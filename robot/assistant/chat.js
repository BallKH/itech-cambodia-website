// iTech Cambodia — AI website assistant — orchestrator
// Pipeline: visitor query -> lexical search over the website index -> if
// nothing relevant, decline locally (no API call) -> else send ONLY the
// top few matching sections to /api/assistant (a same-origin serverless
// proxy — the OpenAI key never reaches the browser, see api/assistant.js)
// -> speak the reply and run whatever navigation action it decided on.

import { getIndex } from "./website-index.js";
import { search } from "./search.js";
import { buildContext, buildCandidates, isOutOfScope } from "./knowledge.js";
import { runAction, actionFromSearchResult } from "./actions.js";

const OUT_OF_SCOPE_REPLY =
  "I'm here to help you explore this website and answer questions about our company, services, and solutions.";

const MAX_QUERY_LENGTH = 300;

export async function ask(query) {
  const trimmed = (query || "").trim().slice(0, MAX_QUERY_LENGTH);
  if (!trimmed) return { reply: "", action: null };

  let index;
  try {
    index = await getIndex();
  } catch {
    return { reply: "I couldn't load the site index just now — please try again in a moment.", action: null };
  }

  const results = search(trimmed, index, 5);

  if (isOutOfScope(results)) {
    return { reply: OUT_OF_SCOPE_REPLY, action: null };
  }

  let data;
  try {
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: trimmed,
        context: buildContext(results),
        candidates: buildCandidates(results),
      }),
    });
    if (!res.ok) throw new Error(`assistant ${res.status}`);
    data = await res.json();
  } catch {
    // Assistant backend unavailable (not configured yet, network hiccup,
    // etc.) — degrade to a plain lexical-search navigation instead of
    // going fully silent.
    const action = actionFromSearchResult(results[0]);
    runAction(action);
    return { reply: `Here's what I found for "${trimmed}" — taking you there now.`, action };
  }

  const action = data.action || null;
  if (action) runAction(action);
  return { reply: data.reply || OUT_OF_SCOPE_REPLY, action };
}
