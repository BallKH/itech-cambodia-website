// iTech Cambodia — AI website assistant — action dispatcher
// Translates the structured `action` object /api/assistant returns (or a
// local fallback built straight from search.js's top hit) into a
// navigation.js call. Keeps chat.js from needing to know any DOM details.

import {
  navigateTo,
  scrollToSection,
  highlightCard,
  openAccordion,
  openContactForm,
  showService,
  focusAssistantInput,
} from "./navigation.js";

/** @param {{type: string, page?: string, section?: string} | null} action */
export function runAction(action) {
  if (!action || !action.type) return;
  switch (action.type) {
    case "navigate":
      navigateTo(action.page, action.section);
      break;
    case "scroll":
      scrollToSection(action.section);
      break;
    case "highlight":
      highlightCard(action.section);
      break;
    case "accordion":
      openAccordion(action.section);
      break;
    case "contact":
      openContactForm();
      break;
    case "service":
      showService(action.section);
      break;
    case "focusSearch":
      focusAssistantInput();
      break;
    default:
      break;
  }
}

/** Fallback when the visitor's query was too off-topic for an OpenAI call
 * (see knowledge.js#isOutOfScope) but still had a decent lexical match —
 * lets the robot navigate even without spending an API call. */
export function actionFromSearchResult(result) {
  if (!result) return null;
  return { type: "navigate", page: result.page, section: result.anchor || undefined };
}
