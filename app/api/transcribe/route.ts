import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/verify-auth';
import { checkRateLimit } from '@/lib/rate-limiter';
import { generateText } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  const userId = await verifyAuthToken(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkRateLimit(userId)) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  try {
    // Note: Full audio transcription requires a dedicated speech-to-text service
    // (Google Cloud Speech-to-Text, Whisper, etc.)
    // For now, we return a placeholder that tells the client to use Web Speech API
    // The useVoiceRecorder hook should prefer Web Speech API if available
    return NextResponse.json({ text: '', message: 'Use Web Speech API for transcription' }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Transcription failed.' }, { status: 500 });
  }
}
