import { describe, it, expect } from "vitest";
import { AREA_META, AREA_LIST, areaTint } from "../area-colors";
import type { ProjectCategory } from "../types/database";

const ALL_AREAS: ProjectCategory[] = [
  "default",
  "personal",
  "professional",
  "financial",
  "wellness",
  "relationship",
  "vision",
  "legal",
];

describe("AREA_META", () => {
  it("covers every ProjectCategory", () => {
    ALL_AREAS.forEach((area) => {
      expect(AREA_META[area]).toBeDefined();
    });
    expect(Object.keys(AREA_META)).toHaveLength(ALL_AREAS.length);
  });

  it("reads every color from a CSS token, never a hardcoded hex", () => {
    ALL_AREAS.forEach((area) => {
      expect(AREA_META[area].color).toBe(`var(--area-${area})`);
      expect(AREA_META[area].bg).toBe(`var(--area-${area}-tint)`);
    });
  });

  it("gives every area a distinct color token", () => {
    const colors = ALL_AREAS.map((a) => AREA_META[a].color);
    expect(new Set(colors).size).toBe(ALL_AREAS.length);
  });

  it("gives every area a distinct tint token", () => {
    const tints = ALL_AREAS.map((a) => AREA_META[a].bg);
    expect(new Set(tints).size).toBe(ALL_AREAS.length);
  });

  it("labels every area with a human-readable name", () => {
    ALL_AREAS.forEach((area) => {
      expect(AREA_META[area].label.length).toBeGreaterThan(0);
      expect(AREA_META[area].value).toBe(area);
    });
  });
});

describe("AREA_LIST", () => {
  it("lists every area with 'default' first so pickers open on the neutral option", () => {
    expect(AREA_LIST).toHaveLength(ALL_AREAS.length);
    expect(AREA_LIST[0].value).toBe("default");
  });

  it("stays in sync with AREA_META", () => {
    AREA_LIST.forEach((meta) => {
      expect(AREA_META[meta.value]).toEqual(meta);
    });
  });
});

describe("areaTint", () => {
  it("returns no tint for the default area so the card keeps its base background", () => {
    expect(areaTint("default")).toBeUndefined();
  });

  it("returns the area tint token for a real area", () => {
    expect(areaTint("financial")).toBe("var(--area-financial-tint)");
    expect(areaTint("wellness")).toBe("var(--area-wellness-tint)");
  });

  it("returns no tint for an unknown area", () => {
    expect(areaTint("nope" as ProjectCategory)).toBeUndefined();
  });
});
