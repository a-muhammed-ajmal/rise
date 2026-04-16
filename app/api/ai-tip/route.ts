import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/verify-auth';
import { checkTipRateLimit } from '@/lib/rate-limiter';
import { generateText } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  const userId = await verifyAuthToken(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkTipRateLimit(userId)) {
    return NextResponse.json(
      { error: 'Daily tip limit reached. Try again tomorrow.' },
      { status: 429 }
    );
  }

  try {
    const prompt = `You are RISE, a personal growth AI coach. Generate ONE concise, actionable daily tip for a UAE-based professional focused on personal development, productivity, and goal achievement.

The tip should:
- Be 1-2 sentences maximum
- Be practical and actionable
- Be motivating without being generic
- Focus on one of: habits, focus, goals, relationships, health, or finance

Return ONLY the tip text, no quotes, no preamble.`;

    const tip = await generateText(prompt);
    return NextResponse.json({ tip: tip.trim() });
  } catch {
    return NextResponse.json(
      { tip: 'Keep showing up. Consistency compounds.' },
      { status: 200 }
    );
  }
}
