// iTech Cambodia — AI website assistant — context builder
// Turns search.js's top-N results into the compact "WEBSITE CONTEXT" block
// sent to /api/assistant. This is the ONLY website content that ever
// reaches OpenAI — never the full site, never raw HTML.

import { ASSISTANT_CONFIG } from "./assistant-config.js";

// Below this TF-IDF score, the visitor's query didn't meaningfully match
// anything on the site — skip the OpenAI call entirely (faster, and avoids
// spending API budget on off-topic questions per the "no unnecessary API
// calls" requirement) and answer with the canned out-of-scope reply.
export function isOutOfScope(results) {
  return !results.length || results[0].score < ASSISTANT_CONFIG.search.relevanceThreshold;
}

// Small talk ("hi", "how are you", "good morning"...) is made entirely of
// search.js stopwords, so it always reduces to zero query tokens and would
// otherwise land on the exact same generic decline as a real off-topic
// question (e.g. "what's the weather") — which reads as broken, not
// intentional. Checked only once a query is already out-of-scope, so it
// never shadows a real question that happens to start with "hi" (e.g. "hi,
// do you offer VMware support?" still searches normally).
const GREETING_PATTERNS = [
  /^(hi|hello|hey|yo|greetings|sup)\b/i,
  /how('?s| is| are)?\s*(it going|things|you doing|you)\b/i,
  /\bgood (morning|afternoon|evening|day)\b/i,
  /what'?s up\b/i,
  /\bwho are you\b/i,
];

export function isGreeting(text) {
  return GREETING_PATTERNS.some((re) => re.test((text || "").trim()));
}

export const GREETING_REPLIES = [
  "Hey there! I'm doing great, thanks for asking. I'm the iTech Cambodia assistant — ask me about our services, cloud, cybersecurity, or how to get in touch.",
  "Hello! 👋 I'm here to help you explore iTech Cambodia — try asking about our services, partners, or reaching our team.",
  "Hi! I'm an AI assistant for iTech Cambodia's website. Ask me about IT infrastructure, cloud & data center, or cybersecurity solutions.",
];

export function buildContext(results) {
  return results
    .map((r, i) => {
      const loc = r.anchor ? `${r.page}#${r.anchor}` : r.page;
      const heading = r.heading ? ` — ${r.heading}` : "";
      return `[${i + 1}] (${r.type || "section"}) ${r.pageTitle}${heading} (${loc})\n${r.text}`;
    })
    .join("\n\n");
}

/** Structured candidates chat.js sends alongside the context so the model
 * only ever has to pick page/section from a closed list, never invent a
 * URL. */
export function buildCandidates(results) {
  return results.map((r) => ({ page: r.page, section: r.anchor || null }));
}
