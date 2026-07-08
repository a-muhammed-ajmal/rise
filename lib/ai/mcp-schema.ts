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
};

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
          },
        ]
      : [],
  );
}
