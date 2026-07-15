// iTech Cambodia — AI website assistant — lexical site search
// Scores every indexed entry (see website-index.js) against the visitor's
// query using plain keyword/synonym overlap — no embeddings, no vector
// store, zero extra API cost per query. Good enough for a handful of pages;
// the final answer's actual language understanding comes from the OpenAI
// call in chat.js, which only ever sees the top few candidates this file
// returns, never the whole site.

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "am", "do", "does", "did", "you", "your", "yours", "i", "we", "our", "ours",
  "of", "to", "for", "in", "on", "at", "and", "or", "with", "about", "need", "want", "have", "has", "had",
  "can", "could", "would", "should", "please", "hi", "hello", "hey", "tell", "me", "show", "what", "how",
  "where", "when", "who", "which", "there", "here", "this", "that", "these", "those", "it", "be", "any",
]);

// Small domain synonym groups so "cybersecurity", "security" and "cyber"
// all expand to hit the same content, without needing embeddings. Every
// term here must be a single tokenize()-able word — the indexed text is
// tokenized by whitespace, so "Trend Micro" becomes two tokens ("trend",
// "micro"), never "trendmicro". Multi-word product names are listed as
// their separate real words for that reason.
const SYNONYM_GROUPS = [
  ["cybersecurity", "security", "cyber", "firewall", "antivirus", "kaspersky", "trend", "micro"],
  ["cloud", "azure", "aws", "digitalocean", "google", "workspace", "hybrid"],
  ["networking", "network", "sdwan", "routing", "switching", "wireless", "wifi", "vpn"],
  ["virtualization", "vmware", "hyperconverged", "hci", "server", "storage"],
  ["surveillance", "cctv", "access", "control", "elv"],
  ["support", "helpdesk", "managed", "maintenance"],
  ["contact", "reach", "talk", "consultation", "quote", "call", "email", "office", "address", "phone"],
  ["about", "company", "who"],
  ["customers", "clients", "portfolio", "case", "studies", "success"],
  ["partners", "partnership", "vendor", "ecosystem"],
  ["software", "development", "app", "erp", "crm", "sap", "saas", "integration"],
  ["ai", "artificial", "intelligence", "business", "bi"],
  ["microsoft", "office", "365", "m365", "dynamics", "sharepoint", "teams"],
  ["backup", "disaster", "recovery", "dr", "continuity"],
  ["industries", "sectors", "manufacturing", "healthcare", "logistics"],
];
const SYNONYM_MAP = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) SYNONYM_MAP.set(term, group);
}

function normalizeToken(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenize(text) {
  return text
    .split(/\s+/)
    .map(normalizeToken)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function expandTokens(tokens) {
  const set = new Set(tokens);
  for (const t of tokens) {
    const group = SYNONYM_MAP.get(t);
    if (group) for (const g of group) set.add(g);
  }
  return set;
}

function flattenIndex(index) {
  const rows = [];
  for (const page of index.pages || []) {
    for (const entry of page.entries || []) {
      rows.push({
        page: page.url,
        pageTitle: page.title,
        anchor: entry.anchor,
        heading: entry.heading || "",
        text: entry.text || "",
      });
    }
  }
  return rows;
}

function scoreRow(row, queryTokens, rawQuery) {
  const headingTokens = tokenize(row.heading);
  const textTokens = tokenize(row.text);
  const titleTokens = tokenize(row.pageTitle);
  let score = 0;
  for (const qt of queryTokens) {
    if (headingTokens.includes(qt)) score += 3;
    if (titleTokens.includes(qt)) score += 2;
    // count occurrences in body text, capped so one keyword-stuffed entry
    // can't dominate every query
    const occurrences = textTokens.filter((t) => t === qt).length;
    score += Math.min(occurrences, 3);
  }
  const haystack = `${row.heading} ${row.text}`.toLowerCase();
  if (rawQuery.length > 3 && haystack.includes(rawQuery)) score += 5;
  return score;
}

/**
 * Returns the top `limit` entries for a natural-language query, each with a
 * `score` (0 = no match at all). Callers gate "out of scope" on
 * results[0]?.score being below a threshold.
 */
export function search(query, index, limit = 5) {
  const rawQuery = (query || "").trim().toLowerCase();
  const queryTokens = [...expandTokens(tokenize(rawQuery))];
  if (!queryTokens.length) return [];

  const rows = flattenIndex(index);
  const scored = rows
    .map((row) => ({ ...row, score: scoreRow(row, queryTokens, rawQuery) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
