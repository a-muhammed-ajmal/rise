import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTextEntry, KEYBOARD_SETTLE_MS, revealFocusedField } from "../keyboard";

function mount<T extends HTMLElement>(el: T): T {
  document.body.appendChild(el);
  return el;
}

describe("isTextEntry", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("accepts text-like inputs and textareas", () => {
    for (const type of ["text", "number", "date", "email", "search", "tel"]) {
      const input = document.createElement("input");
      input.type = type;
      expect(isTextEntry(input)).toBe(true);
    }
    expect(isTextEntry(document.createElement("textarea"))).toBe(true);
  });

  it("rejects inputs that do not open a keyboard", () => {
    for (const type of ["checkbox", "radio", "button", "submit", "range", "file"]) {
      const input = document.createElement("input");
      input.type = type;
      expect(isTextEntry(input)).toBe(false);
    }
  });

  it("accepts contenteditable elements and rejects plain ones", () => {
    const editable = document.createElement("div");
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(isTextEntry(editable)).toBe(true);
    expect(isTextEntry(document.createElement("button"))).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});

describe("revealFocusedField", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("scrolls the focused field to the centre once the keyboard settles", () => {
    const input = mount(document.createElement("input"));
    const scroll = vi.fn();
    input.scrollIntoView = scroll;
    input.focus();

    revealFocusedField(input);
    vi.advanceTimersByTime(KEYBOARD_SETTLE_MS - 1);
    expect(scroll).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
  });

  it("skips the scroll when focus has already moved on", () => {
    const input = mount(document.createElement("input"));
    const other = mount(document.createElement("textarea"));
    const scroll = vi.fn();
    input.scrollIntoView = scroll;
    input.focus();

    revealFocusedField(input);
    other.focus();
    vi.advanceTimersByTime(KEYBOARD_SETTLE_MS);
    expect(scroll).not.toHaveBeenCalled();
  });

  it("can be cancelled", () => {
    const input = mount(document.createElement("input"));
    const scroll = vi.fn();
    input.scrollIntoView = scroll;
    input.focus();

    const cancel = revealFocusedField(input);
    cancel();
    vi.advanceTimersByTime(KEYBOARD_SETTLE_MS);
    expect(scroll).not.toHaveBeenCalled();
  });

  it("ignores targets that do not open a keyboard", () => {
    const button = mount(document.createElement("button"));
    const scroll = vi.fn();
    button.scrollIntoView = scroll;
    button.focus();

    const cancel = revealFocusedField(button);
    vi.advanceTimersByTime(KEYBOARD_SETTLE_MS);
    expect(scroll).not.toHaveBeenCalled();
    expect(() => cancel()).not.toThrow();
  });
});
