import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/verify-auth';
import { checkRateLimit } from '@/lib/rate-limiter';
import { generateChatResponse } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  // Verify auth
  const userId = await verifyAuthToken(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit
  if (!checkRateLimit(userId)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { message, history = [], context } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const systemContext = `You are RISE, a personal life management AI assistant.
You are helpful, motivating, and concise. You help users manage their goals, habits, tasks, and personal growth.
You operate in UAE context (AED currency, UAE work culture).
${context ? `\nUser context: ${context}` : ''}
Keep responses focused and practical. Use bullet points for lists. Be encouraging but direct.`;

    const reply = await generateChatResponse(history, message, systemContext);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'AI assistant is temporarily unavailable.' },
      { status: 500 }
    );
  }
}
