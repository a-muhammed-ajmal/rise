/**
 * Mobile virtual-keyboard helpers for modal surfaces.
 *
 * A dialog or sheet is `position: fixed`, so when the on-screen keyboard opens
 * the browser does not scroll it — the field being typed into can end up
 * hidden behind the keyboard. Wire `revealFocusedField` to a modal's `onFocus`
 * (focus events bubble in React) to scroll the focused field back into view
 * once the keyboard has finished animating in.
 */

/** Roughly how long iOS/Android take to slide the keyboard in. */
export const KEYBOARD_SETTLE_MS = 300;

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** True for elements that summon the on-screen keyboard when focused. */
export function isTextEntry(target: EventTarget | null): target is HTMLElement {
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(target.type);
  }
  return target instanceof HTMLElement && target.isContentEditable === true;
}

/**
 * Scroll a newly focused text field into view after the keyboard settles.
 * Returns a cancel function (also a no-op for non-text targets).
 */
export function revealFocusedField(target: EventTarget | null): () => void {
  if (!isTextEntry(target)) return () => {};
  const timer = window.setTimeout(() => {
    if (document.activeElement !== target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  }, KEYBOARD_SETTLE_MS);
  return () => window.clearTimeout(timer);
}
