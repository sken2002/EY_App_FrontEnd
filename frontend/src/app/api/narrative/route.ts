import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { WPRiskState } from '@/lib/riskEngine/types';
import { SpiderNodeData } from '@/lib/types';

export const runtime = 'edge';

// Fallback generator if API key is missing
function generateMockNarrative(nodeData: SpiderNodeData, state: WPRiskState, criDelta: number): string {
  const wpId = nodeData.label.split(':')[0];
  const highRisks = Object.entries(state.detected).filter(([_, d]) => d.class === 'High').map(([dim]) => dim);
  const mitigations = state.mitigations.filter(m => m.active);
  
  const mockJson = {
    summary: `Analysis complete for ${nodeData.label}. ${criDelta !== 0 ? `Recent levers shifted CRI by ${criDelta > 0 ? '+' : ''}${Math.round(criDelta)}.` : ''}`,
    tactical_actions: highRisks.length > 0 ? [`Address critical pressure in ${highRisks.join(', ')}`] : ["Maintain current operational metrics"],
    strategic_shifts: mitigations.length > 0 ? [`Leverage ${mitigations[0].label}`] : ["Monitor downstream exposure"]
  };

  return JSON.stringify(mockJson);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nodeData, state, delta, globalContext } = body as { 
      nodeData: SpiderNodeData, 
      state: WPRiskState, 
      delta: { criDelta: number },
      globalContext?: { archetype: string, horizon: string }
    };

    if (!nodeData || !state) {
      return NextResponse.json({ error: 'Missing required state payload' }, { status: 400 });
    }

    // Check if API key exists. If not, use the mock stream so the UI doesn't break.
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.warn("GOOGLE_GENERATIVE_AI_API_KEY is not set. Falling back to mock narrative.");
      const narrativeText = generateMockNarrative(nodeData, state, delta?.criDelta || 0);
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const words = narrativeText.split(' ');
          for (const word of words) {
            controller.enqueue(encoder.encode(word + ' '));
            await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
          }
          controller.close();
        },
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' } });
    }

    // ============================================================================
    // REAL GEMINI AI INTEGRATION
    // ============================================================================
    const archetypeStr = globalContext?.archetype || 'Standard Corporate';
    const horizonStr = globalContext?.horizon || 'Short-term (3mo)';
    
    const systemPrompt = `You are the Project Spider Strategist Agent, an expert in enterprise risk management.
You are analyzing a work package risk simulation and must provide a concise, executive-level summary of the cascading risks and mitigations.

CRITICAL CONTEXT:
- Project Archetype: ${archetypeStr}
- Time Horizon: ${horizonStr}

Tailor your mitigation strategies based on the Time Horizon (e.g. immediate tactical fixes for Short-term, strategic realignment for Long-term).
Account for the Project Archetype (e.g. IT projects face different operational realities than Infrastructure projects).
Explain *how* the blast radius propagates rather than just stating numbers.

Focus on the practical impact of the data provided. Use a professional, slightly urgent tone if risks are high, or a reassuring tone if mitigated.
CRITICAL: You MUST respond ONLY with a valid JSON object in the following format. Do not include markdown code blocks or any other text.
{
  "summary": "2-3 short sentences summarizing the risk and blast radius",
  "tactical_actions": ["Bullet 1 for immediate 48h actions", "Bullet 2"],
  "strategic_shifts": ["Bullet 1 for long-term realignment based on archetype"]
}`;

    // Filter out 'Low' risk states and extract key details to save context window tokens
    const highAndMediumRisks = Object.entries(state.detected)
      .filter(([_, d]) => d.class === 'High' || d.class === 'Medium')
      .map(([dim, d]) => `${dim}: ${d.class} (Drivers: ${d.drivers.join(', ')})`);

    const activeMigs = state.mitigations.filter(m => m.active).map(m => m.label);
    const pressures = Object.entries(state.propagated)
      .filter(([_, val]) => val > 0)
      .map(([dim, val]) => `${dim}: +${Math.round(val)} pressure`);

    const prompt = `
Analyze the following Work Package: ${nodeData.label}
Current Simulation Risk Delta: ${delta?.criDelta > 0 ? '+' : ''}${Math.round(delta?.criDelta || 0)}

Risk State:
- Identified Risks: ${highAndMediumRisks.length > 0 ? highAndMediumRisks.join(' | ') : 'None significant'}
- Downstream Pressure: ${pressures.length > 0 ? pressures.join(' | ') : 'None'}
- Active Mitigations: ${activeMigs.length > 0 ? activeMigs.join(', ') : 'None'}
- Blast Radius Exposure: ${state.blastRadius.impactedNodeIds.length} connected entities at risk (£${state.blastRadius.totalExposure.toLocaleString()} total financial exposure).
`;

    // Call Gemini using Vercel AI SDK
    const { generateText } = await import('ai');
    const result = await generateText({
      model: google('gemini-1.5-flash'),
      system: systemPrompt,
      prompt: prompt,
    });

    return NextResponse.json({ narrative: result.text });

  } catch (error) {
    console.error('LLM API Error:', error);
    return NextResponse.json({ error: 'Failed to generate narrative' }, { status: 500 });
  }
}
