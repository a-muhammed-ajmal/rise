/**
 * The one place the Gemini model id lives. Chat, the daily digest and audio
 * transcription all read it from here.
 *
 * Google retires Gemini model ids on its own schedule, and a retired id fails
 * every call with a 404. `GEMINI_MODEL` lets a deployment move to a replacement
 * by changing an environment variable instead of three source files.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
