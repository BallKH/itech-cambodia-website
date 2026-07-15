// iTech Cambodia — AI website assistant — client-side configuration
// Single place for every tunable the assistant modules used to hardcode
// individually (search.js, knowledge.js, chat.js, memory.js). Mirrors the
// pattern already established by robot/config.js for the mascot itself.

export const ASSISTANT_CONFIG = {
  api: {
    endpoint: "/api/assistant",
    streaming: true,
    fetchTimeoutMs: 20000,
    retryCount: 1,
    retryDelayMs: 600,
  },
  query: {
    maxLength: 300,
  },
  search: {
    topN: 6,
    // TF-IDF-weighted score below which a query is treated as out of
    // scope and answered locally without an OpenAI call at all. TF-IDF
    // scores aren't bounded to [0,1] — this is a heuristic floor picked to
    // lean toward calling the API on ambiguous matches rather than
    // wrongly declining a real question. Retune against real traffic if
    // too many/few queries get declined.
    relevanceThreshold: 1.2,
  },
  memory: {
    storageKey: "itech-assistant-history",
    maxTurns: 12, // stored turns (visitor+assistant pairs count as 2)
    maxChars: 6000, // total serialized size cap sent to the server
  },
  debug: {
    // Flip on in a console session via: localStorage.setItem('itech-assistant-debug','1')
    storageKey: "itech-assistant-debug",
  },
};

export function isDebugEnabled() {
  try {
    return localStorage.getItem(ASSISTANT_CONFIG.debug.storageKey) === "1";
  } catch {
    return false;
  }
}
