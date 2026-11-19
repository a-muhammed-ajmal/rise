// The tool registry: tool name → handler, assembled from the domain modules.
//
// A Map rather than a plain object, so a model-supplied name such as
// "toString" or "constructor" can never resolve to an Object.prototype member.
import type { ToolHandler } from "./shared";
import { taskHandlers } from "./tasks";
import { projectHandlers } from "./projects";
import { goalHandlers } from "./goals";
import { wellnessHandlers } from "./wellness";
import { financeHandlers } from "./finance";
import { crmHandlers } from "./crm";
import { knowledgeHandlers } from "./knowledge";
import { reflectionHandlers } from "./reflection";
import { insightHandlers } from "./insights";
import { personalMemoryHandlers } from "./personal-memory";
import { recycleBinHandlers } from "./recycle-bin";
import { whatsappHandlers } from "./whatsapp";

export const TOOL_HANDLERS: ReadonlyMap<string, ToolHandler> = new Map(
  Object.entries({
    ...taskHandlers,
    ...projectHandlers,
    ...goalHandlers,
    ...wellnessHandlers,
    ...financeHandlers,
    ...crmHandlers,
    ...knowledgeHandlers,
    ...reflectionHandlers,
    ...insightHandlers,
    ...personalMemoryHandlers,
    ...recycleBinHandlers,
    ...whatsappHandlers,
  }),
);
