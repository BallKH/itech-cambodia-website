// iTech Cambodia — AI website assistant — chat widget UI
// Deliberately does NOT touch robot.js/robot-rig.js/robot-animation.js —
// the mascot is not being redesigned, just given a companion UI. This
// module waits for the "itech-robot:ready" event robot.js already
// dispatches on its container, then mounts a toggle button + chat panel
// as siblings of the canvas inside that same #itech-robot element, and
// talks to the mascot only through its existing public API
// (window.iTechRobot.speak/hideSpeech/nod).

import { ask } from "./chat.js";
import { supportsVoiceInput, listenOnce } from "./voice.js";

function injectStylesheet() {
  const href = new URL("./assistant.css", import.meta.url).href;
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function icon(inner) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${inner}</svg>`;
}
const CHAT_ICON = icon(
  '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>'
);
const MIC_ICON = icon(
  '<path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v4"/>'
);
const SEND_ICON = icon('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/>');

function buildWidget(container) {
  if (container.querySelector(".itech-assistant-toggle")) return; // idempotent

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "itech-assistant-toggle";
  toggle.setAttribute("aria-label", "Ask the iTech Cambodia assistant");
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = CHAT_ICON;
  container.appendChild(toggle);

  const panel = document.createElement("div");
  panel.className = "itech-assistant-panel";
  panel.innerHTML = `
    <div class="itech-assistant-head">Ask iTech Cambodia</div>
    <div class="itech-assistant-log" id="itech-assistant-log" role="log" aria-live="polite"></div>
    <form class="itech-assistant-form" id="itech-assistant-form" autocomplete="off">
      <input type="text" class="itech-assistant-input" id="itech-assistant-input" placeholder="e.g. I need cybersecurity" maxlength="300" />
      ${supportsVoiceInput() ? `<button type="button" class="itech-assistant-mic" id="itech-assistant-mic" aria-label="Ask by voice">${MIC_ICON}</button>` : ""}
      <button type="submit" class="itech-assistant-send" aria-label="Send">${SEND_ICON}</button>
    </form>
  `;
  container.appendChild(panel);

  // Never let keys typed in the chat box bubble up to robot.js's own
  // container-level keydown handler (Enter there triggers a greeting).
  panel.addEventListener("keydown", (e) => e.stopPropagation());

  const log = panel.querySelector("#itech-assistant-log");
  const form = panel.querySelector("#itech-assistant-form");
  const input = panel.querySelector("#itech-assistant-input");
  const mic = panel.querySelector("#itech-assistant-mic");

  function addMsg(role, text) {
    const el = document.createElement("div");
    el.className = `itech-assistant-msg ${role}`;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  let open = false;
  function setOpen(next) {
    open = next;
    panel.classList.toggle("show", open);
    toggle.setAttribute("aria-expanded", String(open));
    if (open) {
      window.iTechRobot?.hideSpeech();
      setTimeout(() => input.focus(), 200);
    }
  }
  toggle.addEventListener("click", () => setOpen(!open));

  let busy = false;
  async function submitQuery(text) {
    const query = (text || "").trim();
    if (!query || busy) return;
    busy = true;
    addMsg("visitor", query);
    input.value = "";
    const pending = addMsg("robot", "…");
    pending.classList.add("pending");
    window.iTechRobot?.nod();
    try {
      const { reply } = await ask(query);
      pending.textContent = reply;
      pending.classList.remove("pending");
      window.iTechRobot?.speak(reply, 1400);
    } catch {
      pending.textContent = "Sorry, something went wrong — please try again.";
      pending.classList.remove("pending");
    } finally {
      busy = false;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitQuery(input.value);
  });

  if (mic) {
    let recognition = null;
    mic.addEventListener("click", () => {
      if (recognition) {
        recognition.abort();
        return;
      }
      recognition = listenOnce({
        onStart: () => mic.classList.add("listening"),
        onResult: (text) => submitQuery(text),
        onEnd: () => {
          mic.classList.remove("listening");
          recognition = null;
        },
        onError: () => {
          mic.classList.remove("listening");
          recognition = null;
        },
      });
    });
  }

  addMsg("robot", "Hi! Ask me about our services, or tell me where you'd like to go.");
}

function boot() {
  const existing = document.getElementById("itech-robot");
  if (existing) {
    injectStylesheet();
    buildWidget(existing);
    return;
  }
  document.addEventListener(
    "itech-robot:ready",
    (e) => {
      injectStylesheet();
      buildWidget(e.target);
    },
    { once: true }
  );
}

boot();
