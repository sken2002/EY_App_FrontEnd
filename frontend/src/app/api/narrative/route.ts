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
  
  let narrative = `Analysis complete for ${nodeData.label}. `;

  if (criDelta !== 0) {
    narrative += `Recent simulation levers have shifted the Composite Risk Index by ${criDelta > 0 ? '+' : ''}${Math.round(criDelta)} points. `;
  }

  if (highRisks.length > 0) {
    const formattedRisks = highRisks.map(r => r.replace(/([A-Z])/g, ' $1').trim().toLowerCase()).join(' and ');
    narrative += `Critical pressure detected in ${formattedRisks}. `;
    
    const propCount = Object.keys(state.propagated).filter(k => state.propagated[k as keyof typeof state.propagated] > 0).length;
    if (propCount > 0) {
      narrative += `This is cascading into ${propCount} downstream dimensions. `;
    }
  } else {
    narrative += `Primary metrics are operating within acceptable tolerances. `;
  }

  if (mitigations.length > 0) {
    narrative += `However, residual risk is buffered by ${mitigations.length} active mitigating factors, notably ${mitigations[0].label.toLowerCase()}. `;
  }

  if (state.blastRadius.impactedNodeIds.length > 0) {
    narrative += `Failure to contain this package exposes £${state.blastRadius.totalExposure.toLocaleString()} across ${state.blastRadius.impactedNodeIds.length} connected entities. Immediate remediation focus recommended.`;
  } else {
    narrative += `No immediate structural cascade risks identified in the dependency graph.`;
  }

  return narrative;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nodeData, state, delta } = body as { nodeData: SpiderNodeData, state: WPRiskState, delta: { criDelta: number } };

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
    const systemPrompt = `You are the Project Spider Strategist Agent, an expert in enterprise risk management.
You are analyzing a work package risk simulation and must provide a concise, executive-level summary of the cascading risks and mitigations.
Focus on the practical impact of the data provided. Use a professional, slightly urgent tone if risks are high, or a reassuring tone if mitigated.
Do not use markdown formatting like bolding or lists, just return 2-3 short, punchy sentences.`;

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
    const result = await streamText({
      model: google('gemini-1.5-flash'),
      system: systemPrompt,
      prompt: prompt,
    });

    // We use streamText().toTextStreamResponse() instead of toDataStreamResponse() 
    // because our frontend hook reads it as raw text chunks right now.
    return result.toTextStreamResponse();

  } catch (error) {
    console.error('LLM API Error:', error);
    return NextResponse.json({ error: 'Failed to generate narrative' }, { status: 500 });
  }
}
