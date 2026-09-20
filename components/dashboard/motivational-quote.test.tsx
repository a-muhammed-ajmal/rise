import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { MotivationalQuote } from "./motivational-quote";

let hydratedRoot: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(async () => {
  if (hydratedRoot) await act(async () => hydratedRoot?.unmount());
  hydratedRoot = undefined;
  container?.remove();
  container = undefined;
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("MotivationalQuote", () => {
  it("hydrates without mismatched text when server and browser randomness differ", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const serverHtml = renderToString(<MotivationalQuote />);
    container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.append(container);
    random.mockReturnValue(0.999);
    const onRecoverableError = vi.fn();

    await act(async () => {
      if (!container) throw new Error("Missing hydration container");
      hydratedRoot = hydrateRoot(container, <MotivationalQuote />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Daily motivation" }).textContent).not.toBe("");
  });

  it("rotates after five minutes and clears timers on unmount", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const { unmount } = render(<MotivationalQuote />);
    const region = screen.getByRole("region", { name: "Daily motivation" });
    const initialQuote = region.textContent;

    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });
    expect(region.textContent).toBe(initialQuote);
    act(() => { vi.advanceTimersByTime(250); });
    expect(region.textContent).not.toBe(initialQuote);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
