import { streamText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs'; // Required for fs.readFile

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
You are the Project Spider AI Assistant, an autonomous Agentic chatbot.
You have access to tools to query the backend database. 
If the user asks about a specific Work Package, Milestone, or Contract, you MUST use the \`analyze_entity\` tool to get its data before answering.
If the user asks about blast radius or downstream impacts, use the \`get_blast_radius\` tool.

Your role:
- Use your tools autonomously to answer questions.
- Do NOT invent rows, suppliers, milestones, costs, dates, or risk scores.
- Keep answers crisp, highly actionable, and easy to read. Use bullet points where appropriate.

Current Dashboard Context (Use this as your starting point, but use tools for deeper dives):
${JSON.stringify(context, null, 2)}
`;

    const result = await streamText({
      model: google('gemini-1.5-flash'),
      system: systemPrompt,
      messages,
      temperature: 0.2,
      tools: {
        analyze_entity: tool({
          description: 'Fetch deep metrics and risk scores for a specific Work Package, Milestone, or Contract by its ID (e.g. WP-014, M-014-A).',
          parameters: z.object({
            entityId: z.string().describe('The exact ID of the entity.')
          }),
          // @ts-expect-error - bypassing strict type inference for execute
          execute: async ({ entityId }) => {
            try {
              const raw = await fs.readFile(path.join(process.cwd(), 'public', 'data', 'state.json'), 'utf-8');
              const state = JSON.parse(raw);
              const node = state.nodes.find((n: any) => n.id === entityId);
              if (!node) return { error: `Entity ${entityId} not found in database.` };
              return { 
                id: node.id, 
                label: node.data.label, 
                type: node.type,
                metrics: node.data.metrics, 
                dimensions: node.data.dimensions 
              };
            } catch (e) {
              return { error: 'Failed to access database.' };
            }
          }
        }),
        get_blast_radius: tool({
          description: 'Calculate the downstream impact (blast radius) of a specific entity failing.',
          parameters: z.object({
            entityId: z.string().describe('The ID of the entity.')
          }),
          // @ts-expect-error - bypassing strict type inference for execute
          execute: async ({ entityId }) => {
            try {
              const raw = await fs.readFile(path.join(process.cwd(), 'public', 'data', 'state.json'), 'utf-8');
              const state = JSON.parse(raw);
              const impacted = new Set<string>();
              let currentLevel = new Set<string>([entityId]);
              for (let depth = 0; depth < 3; depth++) {
                const nextLevel = new Set<string>();
                for (const edge of state.edges) {
                  if (currentLevel.has(edge.source) && !impacted.has(edge.target)) {
                    impacted.add(edge.target);
                    nextLevel.add(edge.target);
                  }
                }
                if (nextLevel.size === 0) break;
                currentLevel = nextLevel;
              }
              const impactedNodes = Array.from(impacted).map(id => {
                const n = state.nodes.find((n: any) => n.id === id);
                return n ? { id: n.id, label: n.data.label, type: n.type } : { id };
              });
              return { sourceEntity: entityId, impactedNodes };
            } catch (e) {
              return { error: 'Failed to access database.' };
            }
          }
        })
      }
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
