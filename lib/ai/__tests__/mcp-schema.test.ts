import { describe, it, expect } from "vitest";
import { Type, type FunctionDeclaration, type Schema } from "@google/genai";
import {
  geminiSchemaToJsonSchema,
  toMcpInputSchema,
  toMcpToolDefinitions,
} from "../mcp-schema";
import { AUTO_TOOLS } from "../tools";

describe("geminiSchemaToJsonSchema", () => {
  it("maps primitive Gemini types to JSON Schema types", () => {
    expect(geminiSchemaToJsonSchema({ type: Type.STRING }).type).toBe("string");
    expect(geminiSchemaToJsonSchema({ type: Type.NUMBER }).type).toBe("number");
    expect(geminiSchemaToJsonSchema({ type: Type.INTEGER }).type).toBe(
      "integer",
    );
    expect(geminiSchemaToJsonSchema({ type: Type.BOOLEAN }).type).toBe(
      "boolean",
    );
  });

  it("falls back to string for missing or unknown types", () => {
    expect(geminiSchemaToJsonSchema({}).type).toBe("string");
    expect(geminiSchemaToJsonSchema({ type: Type.TYPE_UNSPECIFIED }).type).toBe(
      "string",
    );
  });

  it("carries over description and enum", () => {
    const result = geminiSchemaToJsonSchema({
      type: Type.STRING,
      description: "Task priority",
      enum: ["P1", "P2", "P3"],
    });
    expect(result.description).toBe("Task priority");
    expect(result.enum).toEqual(["P1", "P2", "P3"]);
  });

  it("converts nested objects with required fields", () => {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Title" },
        amount: { type: Type.NUMBER },
      },
      required: ["title"],
    };
    const result = geminiSchemaToJsonSchema(schema);
    expect(result.type).toBe("object");
    expect(result.properties?.title).toEqual({
      type: "string",
      description: "Title",
    });
    expect(result.properties?.amount).toEqual({ type: "number" });
    expect(result.required).toEqual(["title"]);
  });

  it("converts arrays of objects recursively", () => {
    const schema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { name: { type: Type.STRING } },
      },
    };
    const result = geminiSchemaToJsonSchema(schema);
    expect(result.type).toBe("array");
    expect(result.items?.type).toBe("object");
    expect(result.items?.properties?.name).toEqual({ type: "string" });
  });
});

describe("toMcpInputSchema", () => {
  it("returns an empty object schema when parameters are undefined", () => {
    expect(toMcpInputSchema(undefined)).toEqual({
      type: "object",
      properties: {},
    });
  });

  it("always produces a top-level object schema", () => {
    const result = toMcpInputSchema({
      type: Type.OBJECT,
      properties: { query: { type: Type.STRING } },
      required: ["query"],
    });
    expect(result.type).toBe("object");
    expect(result.properties.query).toEqual({ type: "string" });
    expect(result.required).toEqual(["query"]);
  });

  it("omits required when the source has none", () => {
    const result = toMcpInputSchema({
      type: Type.OBJECT,
      properties: { q: { type: Type.STRING } },
    });
    expect(result.required).toBeUndefined();
  });
});

describe("toMcpToolDefinitions", () => {
  it("skips declarations without a name and defaults description", () => {
    const decls: FunctionDeclaration[] = [
      { description: "orphan" },
      { name: "do_thing" },
    ];
    const result = toMcpToolDefinitions(decls);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: "do_thing",
      description: "",
      inputSchema: { type: "object", properties: {} },
    });
  });

  it("converts every real AUTO_TOOLS declaration to a valid MCP tool", () => {
    const result = toMcpToolDefinitions(AUTO_TOOLS);
    expect(result).toHaveLength(AUTO_TOOLS.length);
    for (const tool of result) {
      expect(tool.name).toBeTruthy();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeTypeOf("object");
    }
  });
});
