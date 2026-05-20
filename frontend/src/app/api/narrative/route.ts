import { NextResponse } from 'next/server';
import { WPRiskState } from '@/lib/riskEngine/types';
import { SpiderNodeData } from '@/lib/types';

export const runtime = 'edge';

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
    
    // Add context from propagation
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

    // Generate the dynamic string
    const narrativeText = generateMockNarrative(nodeData, state, delta?.criDelta || 0);

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Split text into words to simulate token-by-token streaming
        const words = narrativeText.split(' ');
        
        for (const word of words) {
          controller.enqueue(encoder.encode(word + ' '));
          // Wait a tiny bit between tokens to simulate LLM latency
          await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('LLM API Error:', error);
    return NextResponse.json({ error: 'Failed to generate narrative' }, { status: 500 });
  }
}
