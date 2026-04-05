import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/verify-auth';
import { chatRateLimiter } from '@/lib/rate-limiter';

/**
 * POST /api/transcribe
 *
 * Accepts an audio file (webm/wav/mp4/m4a), sends it to Gemini's
 * multimodal model for speech-to-text, then cleans the transcript
 * in the same call (removes fillers, stutters, fixes grammar).
 *
 * Returns: { rawTranscript, cleanedTranscript }
 */
export async function POST(req: NextRequest) {
  // Auth + rate limit
  let userId: string;
  try {
    userId = await verifyIdToken(req.headers.get('Authorization'));
    const rl = chatRateLimiter.check(userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'No API key configured' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Validate size (max 10 MB)
    if (audioFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio file too large (max 10 MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    // Determine MIME type
    const mimeType = audioFile.type || 'audio/webm';

    const ai = new GoogleGenAI({ apiKey });

    // Step 1: Raw transcription
    const rawResult = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
            {
              text: 'Transcribe the speech in this audio recording exactly as spoken. Include all filler words (um, uh, like, you know), stutters, repetitions, and false starts. Output ONLY the raw transcript, nothing else.',
            },
          ],
        },
      ],
    });

    const rawTranscript = rawResult?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    if (!rawTranscript) {
      return NextResponse.json({ error: 'Could not transcribe audio. Please speak clearly and try again.' }, { status: 422 });
    }

    // Step 2: Clean the transcript
    const cleanResult = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Clean up the following speech transcript using these strict rules:
- Remove all filler words (um, uh, like, you know, basically, actually, sort of, kind of)
- Remove stutters, repetitions, and false starts
- Fix grammar and sentence structure
- Keep vocabulary simple and professional
- Preserve the original meaning EXACTLY — do not add, infer, or change the intent
- Output ONLY the cleaned text, nothing else

Transcript:
${rawTranscript}`,
            },
          ],
        },
      ],
    });

    const cleanedTranscript = cleanResult?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? rawTranscript;

    return NextResponse.json({ rawTranscript, cleanedTranscript });
  } catch (err: unknown) {
    console.error('Transcribe API error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to transcribe audio. Please try again.' }, { status: 500 });
  }
}
