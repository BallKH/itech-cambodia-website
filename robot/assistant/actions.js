// iTech Cambodia — AI website assistant — action dispatcher (V2)
// Translates the OpenAI function call /api/assistant returns — real
// function-calling now, matching the `name`/args OpenAI sends, not a
// hand-rolled JSON action contract — into a navigation.js call. Keeps
// chat.js from needing to know any DOM details.

import { navigateTo, scrollToSection, highlightCard, openContactForm } from "./navigation.js";
import { logger } from "./logger.js";

/** @param {{type: string, page?: string, section?: string} | null} action */
export function runAction(action) {
  if (!action || !action.type) return;
  logger.debug("running action", action.type, action.page, action.section);
  switch (action.type) {
    case "navigateTo":
      navigateTo(action.page, action.section);
      break;
    case "scrollTo":
      scrollToSection(action.section);
      break;
    case "highlightService":
      highlightCard(action.section);
      break;
    case "openContactForm":
      openContactForm();
      break;
    default:
      logger.warn("unknown action type", action.type);
      break;
  }
}

/** Fallback when the visitor's query was too off-topic for an OpenAI call
 * (see knowledge.js#isOutOfScope) but still had a decent lexical match —
 * lets the robot navigate even without spending an API call. */
export function actionFromSearchResult(result) {
  if (!result) return null;
  return { type: "navigateTo", page: result.page, section: result.anchor || undefined };
}
