import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json(
        { error: 'GOOGLE_GENERATIVE_AI_API_KEY is not set.' },
        { status: 500 }
      );
    }

    const systemPrompt = `
You are the Project Spider AI Assistant, a highly specialized, helpful, and concise risk analyst chatbot.

Your role:
- Answer user questions about the project data, selected work packages, suppliers, and analysed risks.
- Use the provided context (selected node and current dashboard state) as your source of truth.
- Do NOT invent rows, suppliers, milestones, costs, dates, or risk scores.
- For numerical answers, only use numbers explicitly present in the provided context.
- Keep answers crisp, highly actionable, and easy to read. Use bullet points where appropriate.
- If the user asks something completely unrelated to the dashboard or project risk, politely guide them back.

Current Dashboard Context:
${JSON.stringify(context, null, 2)}
`;

    const result = await streamText({
      model: google('gemini-1.5-flash'),
      system: systemPrompt,
      messages,
      temperature: 0.2,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate chat response' },
      { status: 500 }
    );
  }
}
