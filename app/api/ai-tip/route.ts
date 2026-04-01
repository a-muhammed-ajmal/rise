import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/verify-auth';
import { tipRateLimiter } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    const userId = await verifyIdToken(req.headers.get('Authorization'));
    const rateLimitResult = tipRateLimiter.check(userId);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Too many requests.' },
        { status: 429 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ tip: 'Focus on one task at a time. Small progress is still progress.' });
  }

  try {
    const { context } = await req.json();
    const ai = new GoogleGenAI({ apiKey });

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: `Based on this user's life data, give ONE short motivational insight or actionable tip (max 2 sentences). Be specific if possible. Data: ${context || 'New user, no data yet.'}` }],
      }],
    });

    const tip = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? 'Every day is a chance to rise higher.';
    return NextResponse.json({ tip });
  } catch {
    return NextResponse.json({ tip: 'Start your day with your most important task. Momentum builds success.' });
  }
}
