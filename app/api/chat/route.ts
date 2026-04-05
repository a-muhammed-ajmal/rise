import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/verify-auth';
import { chatRateLimiter } from '@/lib/rate-limiter';
import { sanitizeContext } from '@/lib/sanitizer';

export async function POST(req: NextRequest) {
  try {
    const userId = await verifyIdToken(req.headers.get('Authorization'));
    const rateLimitResult = chatRateLimiter.check(userId);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Too many requests.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) } }
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
    const { message, context, history } = await req.json();

    // Privacy: Sanitize context to remove any PII that might have slipped through
    const sanitizedContext = sanitizeContext(context || '');

    const systemPrompt = `You are the AI Assistant for RISE — a personal life management app owned by Muhammed Ajmal.
You have full access to all of Ajmal's life data which is provided below as context.
Your role is to:
- Answer questions about his actions, rhythms, finances, targets, relationships, deals, leads, reviews, and documents
- RISE uses specific terminology: Realms (life domains), Targets (objectives), Actions (concrete steps), Rhythms (recurring behaviors)
- Provide insights, summaries, and actionable advice based on his real data
- Help him stay productive, track progress, and make better decisions
- Be concise, specific, and reference actual data points (names, numbers, dates)
- Use AED as currency (he is based in UAE)
- When asked about progress, calculate percentages and give honest assessments
- Suggest priorities based on due dates, overdue items, and incomplete actions
- Be motivational and growth-oriented — aligned with the RISE brand

CURRENT DATA:
${sanitizedContext}

Respond naturally and helpfully. Keep answers focused and actionable.`;

    const ai = new GoogleGenAI({ apiKey });

    const chatHistory = (history || []).map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I have access to all of Ajmal\'s RISE data. I\'m ready to help.' }] },
        ...chatHistory,
        { role: 'user', parts: [{ text: message }] },
      ],
    });

    const reply = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? 'Sorry, I could not generate a response.';
    return NextResponse.json({ reply });
  } catch (err: unknown) {
    // Log full details server-side only — never forward raw error messages to
    // the client since Gemini errors can contain API internals or quota info.
    console.error('Chat API error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to generate a response. Please try again.' }, { status: 500 });
  }
}
