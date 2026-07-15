// iTech Cambodia — AI website assistant — context builder
// Turns search.js's top-N results into the compact "WEBSITE CONTEXT" block
// sent to /api/assistant. This is the ONLY website content that ever
// reaches OpenAI — never the full site, never raw HTML.

// Below this lexical score, the visitor's query didn't meaningfully match
// anything on the site — skip the OpenAI call entirely (faster, and avoids
// spending API budget on off-topic questions per the "no unnecessary API
// calls" requirement) and answer with the canned out-of-scope reply.
const RELEVANCE_THRESHOLD = 3;

export function isOutOfScope(results) {
  return !results.length || results[0].score < RELEVANCE_THRESHOLD;
}

export function buildContext(results) {
  return results
    .map((r, i) => {
      const loc = r.anchor ? `${r.page}#${r.anchor}` : r.page;
      const heading = r.heading ? ` — ${r.heading}` : "";
      return `[${i + 1}] ${r.pageTitle}${heading} (${loc})\n${r.text}`;
    })
    .join("\n\n");
}

/** Structured candidates chat.js sends alongside the context so the model
 * only ever has to pick page/section from a closed list, never invent a
 * URL. */
export function buildCandidates(results) {
  return results.map((r) => ({ page: r.page, section: r.anchor || null }));
}
