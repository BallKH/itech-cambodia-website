// iTech Cambodia — AI website assistant — voice input
// Speech OUTPUT deliberately reuses the mascot's existing
// window.iTechRobot.speak() (real SpeechSynthesis + speech bubble, already
// gated on the same "no autoplay until a user gesture" rule as every other
// sound on this site) instead of duplicating that logic here. This file is
// only the microphone side: Web Speech API's SpeechRecognition.

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

export function supportsVoiceInput() {
  return !!SpeechRecognitionCtor;
}

/**
 * Starts a single-utterance listen. Returns the recognition instance (call
 * .abort() to cancel), or null if the browser doesn't support it.
 */
export function listenOnce({ onResult, onStart, onEnd, onError }) {
  if (!SpeechRecognitionCtor) {
    onError?.(new Error("Speech recognition isn't supported in this browser."));
    return null;
  }
  const recognition = new SpeechRecognitionCtor();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => onStart?.();
  recognition.onresult = (e) => {
    const transcript = e.results?.[0]?.[0]?.transcript || "";
    onResult?.(transcript.trim());
  };
  recognition.onerror = (e) => onError?.(e);
  recognition.onend = () => onEnd?.();

  try {
    recognition.start();
  } catch (err) {
    onError?.(err);
    return null;
  }
  return recognition;
}
