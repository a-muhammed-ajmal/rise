import Anthropic from "@anthropic-ai/sdk";

// The daily digest is the one place in RISE where the model has to synthesise
// rather than dispatch. Chat is tool routing — "log expense 50 AED" — which
// Gemini Flash handles well and cheaply. The digest reads a whole day across
// six modules and is asked for an insight, which is a different job.
//
// It is also the only place where a stronger model is close to free: one call
// per day, and no tool definitions in the prompt (the 84 FunctionDeclarations
// that dominate a chat request are absent here). That is why this route moved
// to Claude and the chat route deliberately did not.
//
// Deliberately NOT using the beta `fallbacks` parameter. A digest of your own
// tasks and expenses has no realistic refusal surface, and a nightly cron that
// already fails closed should not also carry a beta API dependency. The
// refusal stop_reason is handled explicitly below instead.

const MODEL = "claude-opus-5";

// A ~300 word digest needs nowhere near this, but max_tokens is a ceiling and
// not a charge — only generated tokens are billed. Leaving headroom avoids a
// truncated digest if adaptive thinking runs long on a busy day.
const MAX_TOKENS = 16_000;

export const DIGEST_UNAVAILABLE = "Daily digest unavailable.";

export async function generateDigestWithClaude(prompt: string): Promise<string> {
  // Reads ANTHROPIC_API_KEY from the environment; never pass a key in.
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    // Summarising a day is not hard reasoning. `medium` keeps the nightly cost
    // near nothing without flattening the one insight the digest asks for.
    output_config: { effort: "medium" },
    messages: [{ role: "user", content: prompt }],
  });

  // stop_details is only populated on a refusal — guard before reading it.
  if (response.stop_reason === "refusal") {
    console.error(
      "[digest-model] refused:",
      response.stop_details?.category ?? "unknown",
    );
    return DIGEST_UNAVAILABLE;
  }

  // content is a discriminated union; narrow before reaching for .text.
  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();

  return text || DIGEST_UNAVAILABLE;
}
