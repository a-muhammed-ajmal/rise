import { Type, type FunctionDeclaration, type Schema } from "@google/genai";

// Minimal JSON Schema shape — MCP clients only need this subset for tool inputs
export type JsonSchemaValue = {
  type: string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaValue;
  properties?: Record<string, JsonSchemaValue>;
  required?: string[];
};

export type McpInputSchema = {
  type: "object";
  properties: Record<string, JsonSchemaValue>;
  required?: string[];
};

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: McpInputSchema;
  annotations: {
    title: string;
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
};

const READ_ONLY_PREFIXES = ["list_", "get_", "search_", "recall_"];

export function isReadOnlyMcpToolName(name: string): boolean {
  return READ_ONLY_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function toolTitle(name: string): string {
  return name
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

const TYPE_MAP: Partial<Record<Type, string>> = {
  [Type.STRING]: "string",
  [Type.NUMBER]: "number",
  [Type.INTEGER]: "integer",
  [Type.BOOLEAN]: "boolean",
  [Type.ARRAY]: "array",
  [Type.OBJECT]: "object",
};

export function geminiSchemaToJsonSchema(schema: Schema): JsonSchemaValue {
  const result: JsonSchemaValue = {
    type: (schema.type && TYPE_MAP[schema.type]) || "string",
  };
  if (schema.description) result.description = schema.description;
  if (schema.enum?.length) result.enum = [...schema.enum];
  if (schema.items) result.items = geminiSchemaToJsonSchema(schema.items);
  if (schema.properties) {
    const properties: Record<string, JsonSchemaValue> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      properties[key] = geminiSchemaToJsonSchema(value);
    }
    result.properties = properties;
  }
  if (schema.required?.length) result.required = [...schema.required];
  return result;
}

export function toMcpInputSchema(
  parameters: Schema | undefined,
): McpInputSchema {
  if (!parameters) return { type: "object", properties: {} };
  const converted = geminiSchemaToJsonSchema(parameters);
  const inputSchema: McpInputSchema = {
    type: "object",
    properties: converted.properties ?? {},
  };
  if (converted.required?.length) inputSchema.required = converted.required;
  return inputSchema;
}

export function toMcpToolDefinitions(
  declarations: FunctionDeclaration[],
): McpToolDefinition[] {
  return declarations.flatMap((decl) =>
    decl.name
      ? [
          {
            name: decl.name,
            description: decl.description ?? "",
            inputSchema: toMcpInputSchema(decl.parameters),
            annotations: {
              title: toolTitle(decl.name),
              readOnlyHint: isReadOnlyMcpToolName(decl.name),
              destructiveHint:
                decl.name.startsWith("delete_") ||
                decl.name.startsWith("purge_") ||
                decl.name.startsWith("forget_") ||
                decl.name === "bulk_delete_records",
              idempotentHint: isReadOnlyMcpToolName(decl.name),
              openWorldHint: false,
            },
          },
        ]
      : [],
  );
}
