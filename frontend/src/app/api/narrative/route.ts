import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { WPRiskState } from '@/lib/riskEngine/types';
import { SpiderNode, SpiderNodeData } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * Global context can be supplied by the frontend when available.
 *
 * In the current MVP / synthetic-data setting, most business context will be
 * inferred by the LLM from operational clues rather than provided as hard data.
 * Keep these fields optional so the API works with both synthetic and richer
 * future datasets.
 */
type GlobalContext = {
  archetype?: string;
  horizon?: string;

  // Optional future enrichment fields. These are not compulsory for the MVP.
  strategicObjective?: string;
  businessPriority?: 'Low' | 'Medium' | 'High' | 'Critical';
  expectedBenefit?: string;
  valueAtStake?: number;
};

type NarrativeRequestBody = {
  node: SpiderNode;
  simulationState: WPRiskState;
  simulationDelta?: { criDelta?: number };
  dataQualityConfidence: number;
  blastRadius: any;
  contextEnv?: {
    upstreamDependencies: string[];
    downstreamDependencies: string[];
    impactedDependencies: string[];
    activePersona?: string;
  };
};

/**
 * Structured response used by the RightPanel.
 *
 * The extra business-context fields allow the AI to appear more strategic & contextualized
 * without inputting real project objectives.
 */
type NarrativeResponse = {
  executive_summary: string;
  active_pathway: string;
  propagation_confidence: 'Low' | 'Medium' | 'High';
  key_drivers: string[];
  blast_radius: string;
  residual_risk_view: string;

  tactical_actions: string[];
  assumptions_and_limits: string[];
};

function getNodeField(nodeData: any, key: string): unknown {
  return nodeData?.[key];
}

/**
 * Fallback narrative keeps the demo usable when:
 * - the Gemini API key is missing,
 * - the model returns invalid JSON,
 * - or the AI call fails.
 *
 * It uses only deterministic state from the risk engine and avoids inventing
 * project facts. The business-context section is deliberately labelled as
 * inferred/limited.
 */
function buildFallbackNarrative(
  nodeData: SpiderNodeData,
  state: WPRiskState,
  criDelta: number,
  failureReason?: string
): NarrativeResponse {
  const materialRisks = Object.entries(state.detected ?? {})
    .filter(([_, d]) => d.class === 'High' || d.class === 'Medium')
    .map(([dim, d]) => `${dim}: ${d.class}${d.drivers?.length ? ` (${d.drivers.join(', ')})` : ''}`);

  const activeMitigations = (state.mitigations ?? []).filter(m => m.active).map(m => m.label);
  const impactedCount = state.blastRadius?.impactedNodeIds?.length ?? 0;
  const exposure = state.blastRadius?.totalExposure ?? 0;

  return {
    executive_summary: `${failureReason ? `[SYSTEM: ${failureReason}] ` : ''}${nodeData.label} shows ${materialRisks.length > 0 ? 'material risk pressure' : 'limited material risk pressure'} under the current deterministic simulation. ${criDelta !== 0 ? `The simulated CRI movement is ${criDelta > 0 ? '+' : ''}${Math.round(criDelta)}.` : 'No material CRI movement is currently detected.'}`,
    active_pathway: materialRisks.length > 0 ? materialRisks.map(r => r.split(':')[0]).join(' → ') : 'No active multi-step pathway detected',
    propagation_confidence: impactedCount >= 3 || materialRisks.some(r => r.includes('High')) ? 'High' : materialRisks.length > 0 ? 'Medium' : 'Low',
    key_drivers: materialRisks.length > 0 ? materialRisks : ['No significant medium/high deterministic triggers detected'],
    blast_radius: `${impactedCount} connected entities are affected, with approximately £${exposure.toLocaleString()} financial exposure.`,
    residual_risk_view: activeMitigations.length > 0 ? `Active mitigations are applied: ${activeMitigations.join(', ')}.` : 'No active mitigation is currently applied, so residual risk remains close to baseline simulation output.',

    tactical_actions: materialRisks.length > 0 ? ['Validate the highest-risk driver with the workstream owner.', 'Prioritise intervention on the first downstream dependency in the blast radius.'] : ['Maintain monitoring and refresh metrics when new project data is available.'],
    assumptions_and_limits: [
      'This narrative is based only on the deterministic payload supplied by the risk engine.',
      'Business context is inferred from synthetic data and should not be treated as confirmed project fact.',
      'The AI does not recalculate CRI, thresholds, exposure, or graph topology.'
    ]
  };
}

/**
 * Gemini may return JSON wrapped in ```json fences.
 * This helper strips common markdown wrappers before parsing.
 */
function safeJsonParse(text: string): NarrativeResponse | null {
  try {
    // Highly robust JSON extraction: find the first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
      console.error('No JSON braces found in Gemini output:', text);
      return null;
    }
    
    const cleaned = text.substring(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(cleaned) as NarrativeResponse;

    if (!parsed.executive_summary || !parsed.active_pathway || !parsed.key_drivers) {
      console.error('JSON parsed successfully but missing required fields:', parsed);
      return null;
    }

    return parsed;
  } catch (err) {
    console.error('Failed to parse Gemini JSON output:', err, 'Raw text:', text);
    return null;
  }
}

export async function POST(req: Request) {
  let fallbackNodeData: any = null;
  let fallbackState: any = null;
  let fallbackCriDelta: number = 0;

  try {
    const body = (await req.json()) as NarrativeRequestBody;
    const { node, simulationState: state, simulationDelta: delta } = body;
    const nodeData = node.data;

    fallbackNodeData = nodeData;
    fallbackState = state;
    fallbackCriDelta = delta?.criDelta ?? 0;

    if (!nodeData || !state) {
      return NextResponse.json({ error: 'Missing required deterministic state payload' }, { status: 400 });
    }

    const criDelta = delta?.criDelta ?? 0;

    const materialRisks = Object.entries(state.detected ?? {})
      .filter(([_, d]) => d.class === 'High' || d.class === 'Medium')
      .map(([dimension, d]) => ({
        dimension,
        class: d.class,
        drivers: d.drivers ?? []
      }));

    const propagationPressures = Object.entries(state.propagated ?? {})
      .filter(([_, value]) => value > 0)
      .map(([dimension, value]) => ({ dimension, pressure_delta: Math.round(value) }));

    const activeMitigations = (state.mitigations ?? [])
      .filter(m => m.active)
      .map(m => m.label);

    const businessContextClues = {
      supplied_business_context: null,
      inference_clues: {
        work_package_name: nodeData.label,
        workstream: getNodeField(nodeData, 'group') ?? null,
        location: getNodeField(nodeData, 'location') ?? null,
        priority: getNodeField(nodeData, 'priority') ?? null,
        planned_cost: getNodeField(nodeData, 'plannedCost') ?? getNodeField(nodeData, 'planned_cost') ?? null,
        completion: getNodeField(nodeData, 'completion') ?? getNodeField(nodeData, 'completionPct') ?? null,
        downstream_impacted_count: state.blastRadius?.impactedNodeIds?.length ?? 0,
        downstream_financial_exposure: state.blastRadius?.totalExposure ?? 0,
        active_risk_dimensions: materialRisks.map(r => r.dimension)
      }
    };

    const deterministicPayload = {
      work_package: {
        label: nodeData.label,
        group: getNodeField(nodeData, 'group') ?? null,
        original_data: nodeData
      },
      context: {
        business_context_clues: businessContextClues,
        network_topology: {
          upstream_dependencies: body.contextEnv?.upstreamDependencies ?? [],
          downstream_dependencies: body.contextEnv?.downstreamDependencies ?? [],
          blast_radius_impacted_entities: body.contextEnv?.impactedDependencies ?? []
        }
      },
      simulation: {
        cri_delta: Math.round(criDelta),
        material_risks: materialRisks,
        propagation_pressures: propagationPressures,
        active_mitigations: activeMitigations,
        blast_radius: {
          impacted_node_count: state.blastRadius?.impactedNodeIds?.length ?? 0,
          impacted_node_ids: state.blastRadius?.impactedNodeIds ?? [],
          total_financial_exposure: state.blastRadius?.totalExposure ?? 0
        }
      },
      active_scenarios: state.activeScenarios?.map(s => ({
        scenario_name: s.name,
        confidence: s.confidence,
        description: s.description
      })) || []
    };

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({
        narrative: buildFallbackNarrative(nodeData, state, criDelta, "MISSING_API_KEY_ENV_VAR"),
        source: 'fallback'
      });
    }

    const activePersona = body.contextEnv?.activePersona || 'Global Executive';
    
    let personaInstruction = '';
    if (activePersona === 'Project Manager (IT)') {
      personaInstruction = "As an IT Project Manager, emphasize schedule blockers, resource reallocation, and operational bottlenecks. Focus deeply on the immediate downstream delivery impacts.";
    } else if (activePersona === 'Risk Auditor') {
      personaInstruction = "As a Risk Auditor, emphasize compliance gaps, supplier SLA violations, cost variances, and financial exposure. Scrutinize the data reliability.";
    } else {
      personaInstruction = "As a Global Executive, focus on the high-level financial 'blast radius', critical supply chain failures, and decisive executive actions.";
    }

    const systemPrompt = `You are Project Spider's Chief Strategist AI.

Your role:
- ${personaInstruction}
- Explain the risk output in clear, accessible, and highly professional language.
- Structure your insights with a natural "Situation -> Cause -> Action" flow.
- Anchor your claims to the exact entities provided in the EXACT DETERMINISTIC PAYLOAD, but avoid overwhelming the user with too many dense statistics. Keep it intuitive and elegant.
- ZERO generic buzzwords. ZERO management consulting fluff like "monitor situation" or "prioritize intervention".

Strict Rules for Tactical Actions:
1. Never provide generic advice. Give clear, pragmatic steps.
2. You MUST EXPLICITLY use the exact names of the entities provided in the "network_topology" arrays (e.g. upstream_dependencies, blast_radius_impacted_entities).
3. Frame actions logically: What is the situation, what caused it, and what exact entity must be engaged to fix it?
4. Example Good: "To prevent further delay to 'Milestone Substantial Completion', work directly with 'CN-15936 - Elite Construction Ltd.' to clear their current compliance blockers."
5. Example Bad: "Clear blockers on upstream dependencies."

Business-context rules:
- Rely ONLY on the exact metrics, propagation pressures, and blast radius provided in the payload. No hallucinations.

Return ONLY valid JSON with this exact shape:
{
  "executive_summary": "2-3 concise sentences on current risk posture and why it matters.",
  "active_pathway": "A concise pathway such as Supplier → Delivery → Cost, or 'No active multi-step pathway detected'.",
  "propagation_confidence": "Low | Medium | High",
  "key_drivers": ["Driver 1", "Driver 2", "Driver 3"],
  "blast_radius": "Plain-English explanation of connected exposure using only supplied numbers.",
  "residual_risk_view": "How mitigations change or fail to change the remaining risk.",
  "tactical_actions": ["Immediate action 1", "Immediate action 2"],
  "assumptions_and_limits": ["Limit 1", "Limit 2"]
}`;

    const strategistUserPrompt = `Analyze this deterministic payload and synthesize an executive risk response.

=== EXACT DETERMINISTIC PAYLOAD ===
${JSON.stringify(deterministicPayload, null, 2)}

=== CONTEXT ===
Work Package: ${nodeData.label}
CRI Delta: ${criDelta > 0 ? '+' : ''}${Math.round(criDelta)}
Mitigations: ${activeMitigations.join(', ') || 'None'}

CRITICAL INSTRUCTION: You MUST return ONLY a single, valid JSON object exactly matching the required structure. Do NOT wrap the JSON in markdown blocks. Do NOT include any conversational text.`;

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: strategistUserPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.25
      }
    });

    const parsed = safeJsonParse(result.text || '');

    if (!parsed) {
      return NextResponse.json({
        narrative: buildFallbackNarrative(nodeData, state, criDelta, "AI_JSON_PARSE_FAILED"),
        source: 'fallback_after_invalid_ai_json',
        raw_model_output: result.text || ''
      });
    }

    return NextResponse.json({ narrative: parsed, source: 'gemini' });
  } catch (error) {
    console.error('Narrative API Error:', error);
    // Graceful degradation: If LLM fails (timeout, rate limit, etc), return the deterministic fallback
    if (fallbackNodeData && fallbackState) {
      return NextResponse.json({
        narrative: buildFallbackNarrative(fallbackNodeData, fallbackState, fallbackCriDelta, `API_ERROR: ${String(error).substring(0, 100)}`),
        source: 'fallback_after_api_error',
        raw_model_output: String(error)
      });
    }
    return NextResponse.json({ error: 'Failed to generate narrative' }, { status: 500 });
  }
}
