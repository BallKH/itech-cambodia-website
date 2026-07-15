// iTech Cambodia — AI website assistant — automatic lexical search (V2)
// Replaces V1's hand-maintained synonym list with statistics computed
// directly from the site's own indexed content: classic TF-IDF over the
// entries scripts/build_website_index.py extracts. No manual keyword
// curation, no embeddings/vector store, zero extra API cost per query —
// the corpus is small enough (under 100 entries) that this runs in
// microseconds in the browser.
//
// Automatic light stemming (plurals/-ing/-ed suffix stripping) is the one
// generalization applied on top of raw tokens — still purely mechanical,
// not a domain-specific synonym table.

import { ASSISTANT_CONFIG } from "./assistant-config.js";

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "am", "do", "does", "did", "you", "your", "yours", "i", "we", "our", "ours",
  "of", "to", "for", "in", "on", "at", "and", "or", "with", "about", "need", "want", "have", "has", "had",
  "can", "could", "would", "should", "please", "hi", "hello", "hey", "tell", "me", "show", "what", "how",
  "where", "when", "who", "which", "there", "here", "this", "that", "these", "those", "it", "be", "any",
]);

const HEADING_WEIGHT = 2.5;
const TITLE_WEIGHT = 1.5;
const TYPE_WEIGHT = { meta: 1.6, service: 1.3, card: 1.1, faq: 1.4, panel: 1.1, section: 1 };

function normalizeToken(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Very small mechanical stemmer — strips common English suffixes so
 * "networks"/"networking" both reduce toward "network" without a
 * hand-written synonym table. Intentionally conservative to avoid
 * collapsing unrelated words together. */
function stem(word) {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 5) return word.slice(0, -3) + "y";
  if (word.endsWith("ing") && word.length > 6) return word.slice(0, -3);
  if (word.endsWith("ed") && word.length > 5) return word.slice(0, -2);
  if (word.endsWith("es") && word.length > 5) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 4) return word.slice(0, -1);
  return word;
}

function tokenize(text) {
  return (text || "")
    .split(/\s+/)
    .map(normalizeToken)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

function flattenIndex(index) {
  const rows = [];
  for (const page of index.pages || []) {
    for (const entry of page.entries || []) {
      rows.push({
        page: page.url,
        pageTitle: page.title,
        anchor: entry.anchor,
        type: entry.type || "section",
        heading: entry.heading || "",
        text: entry.text || "",
      });
    }
  }
  return rows;
}

/** Builds (and caches on the index object itself) the TF-IDF model: each
 * row's weighted term-frequency map, plus corpus-wide document frequency. */
function buildModel(index) {
  if (index.__tfidfModel) return index.__tfidfModel;

  const rows = flattenIndex(index);
  const titleTokens = new Map(); // page url -> Set(tokens), computed once per page
  const docFreq = new Map();

  const docs = rows.map((row) => {
    const tf = new Map();
    const add = (tokens, weight) => {
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + weight);
    };
    add(tokenize(row.text), 1);
    add(tokenize(row.heading), HEADING_WEIGHT);

    if (!titleTokens.has(row.page)) titleTokens.set(row.page, tokenize(row.pageTitle));
    add(titleTokens.get(row.page), TITLE_WEIGHT);

    for (const term of tf.keys()) docFreq.set(term, (docFreq.get(term) || 0) + 1);
    return { row, tf };
  });

  const n = docs.length || 1;
  const idf = new Map();
  for (const [term, df] of docFreq) idf.set(term, Math.log((n + 1) / (df + 1)) + 1);

  const model = { docs, idf };
  Object.defineProperty(index, "__tfidfModel", { value: model, enumerable: false });
  return model;
}

function scoreDoc(doc, idf, queryTokens) {
  let score = 0;
  for (const qt of queryTokens) {
    const tf = doc.tf.get(qt);
    if (!tf) continue;
    score += tf * (idf.get(qt) || 0);
  }
  return score * (TYPE_WEIGHT[doc.row.type] || 1);
}

/**
 * Returns the top `limit` entries for a natural-language query, each with
 * a `score` (0 = no term overlap at all). Callers gate "out of scope" on
 * results[0]?.score against ASSISTANT_CONFIG.search.relevanceThreshold.
 */
export function search(query, index, limit = ASSISTANT_CONFIG.search.topN) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];

  const { docs, idf } = buildModel(index);
  const scored = docs
    .map(({ row, tf }) => ({ ...row, score: scoreDoc({ row, tf }, idf, queryTokens) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
