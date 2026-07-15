// iTech Cambodia — AI website assistant — DOM navigation primitives
// The only module that actually touches the page (scrolling, class
// toggles, focus). actions.js decides *what* to do; this file is *how*.
// Every function is defensive — a missing element is a no-op, never a
// thrown error, since the assistant must never break the page it's
// helping visitors navigate.

function currentPageFile() {
  const path = window.location.pathname;
  const file = path.split("/").pop();
  return file && file.length ? file : "index.html";
}

function highlightEl(el) {
  if (!el) return;
  el.classList.add("itech-assistant-highlight");
  setTimeout(() => el.classList.remove("itech-assistant-highlight"), 2200);
}

export function scrollToSection(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  highlightEl(el);
}

/** services.html's three service tabs are real buttons with a click
 * handler in js/main.js that also drives location.hash — reuse that
 * exact mechanism instead of re-implementing tab switching here. */
export function activateServiceTab(sectionId) {
  const tab = document.querySelector(`.svc-tab[data-target="${sectionId}"]`);
  if (tab) {
    tab.click();
    tab.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }
  return false;
}

export function navigateTo(page, sectionId) {
  const target = page || currentPageFile();
  if (target === currentPageFile()) {
    if (sectionId) {
      if (!activateServiceTab(sectionId)) scrollToSection(sectionId);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return;
  }
  window.location.href = sectionId ? `${target}#${sectionId}` : target;
}

export function highlightCard(id) {
  highlightEl(document.getElementById(id));
}

export function openAccordion(id) {
  const el = document.getElementById(id);
  if (el && "open" in el) el.open = true;
  highlightEl(el);
}

export function openContactForm() {
  navigateTo("contact.html");
  setTimeout(() => document.getElementById("name")?.focus(), 500);
}

export function showService(sectionId) {
  navigateTo("services.html", sectionId);
}

export function focusAssistantInput() {
  document.getElementById("itech-assistant-input")?.focus();
}
