import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { WPRiskState } from '@/lib/riskEngine/types';
import { SpiderNode, SpiderNodeData } from '@/lib/types';

export const runtime = 'edge';

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

  // Business-context interpretation. These may be inferred assumptions.
  business_context_view: string;
  inferred_strategic_objective: string;
  benefit_preservation_view: string;
  context_confidence: 'Low' | 'Medium' | 'High';

  tactical_actions: string[];
  strategic_shifts: string[];
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
  criDelta: number
): NarrativeResponse {
  const materialRisks = Object.entries(state.detected ?? {})
    .filter(([_, d]) => d.class === 'High' || d.class === 'Medium')
    .map(([dim, d]) => `${dim}: ${d.class}${d.drivers?.length ? ` (${d.drivers.join(', ')})` : ''}`);

  const activeMitigations = (state.mitigations ?? []).filter(m => m.active).map(m => m.label);
  const impactedCount = state.blastRadius?.impactedNodeIds?.length ?? 0;
  const exposure = state.blastRadius?.totalExposure ?? 0;

  const workstream = String(getNodeField(nodeData, 'group') ?? 'the relevant workstream');
  const location = getNodeField(nodeData, 'location');
  const contextConfidence: NarrativeResponse['context_confidence'] = 'Low';

  return {
    executive_summary: `${nodeData.label} shows ${materialRisks.length > 0 ? 'material risk pressure' : 'limited material risk pressure'} under the current deterministic simulation. ${criDelta !== 0 ? `The simulated CRI movement is ${criDelta > 0 ? '+' : ''}${Math.round(criDelta)}.` : 'No material CRI movement is currently detected.'}`,
    active_pathway: materialRisks.length > 0 ? materialRisks.map(r => r.split(':')[0]).join(' → ') : 'No active multi-step pathway detected',
    propagation_confidence: impactedCount >= 3 || materialRisks.some(r => r.includes('High')) ? 'High' : materialRisks.length > 0 ? 'Medium' : 'Low',
    key_drivers: materialRisks.length > 0 ? materialRisks : ['No significant medium/high deterministic triggers detected'],
    blast_radius: `${impactedCount} connected entities are affected, with approximately £${exposure.toLocaleString()} financial exposure.`,
    residual_risk_view: activeMitigations.length > 0 ? `Active mitigations are applied: ${activeMitigations.join(', ')}.` : 'No active mitigation is currently applied, so residual risk remains close to baseline simulation output.',

    business_context_view: `This work package appears connected to ${workstream}${location ? ` in ${location}` : ''}.`,
    inferred_strategic_objective: 'Inferred objective: preserve delivery continuity and avoid wider programme disruption.',
    benefit_preservation_view: activeMitigations.length > 0
      ? 'Mitigation appears relevant if it preserves downstream delivery confidence and prevents local risk from becoming a broader programme issue.'
      : 'Without active mitigation, the main benefit-preservation concern is whether local risk could create avoidable delay, cost pressure, or downstream disruption.',
    context_confidence: contextConfidence,

    tactical_actions: materialRisks.length > 0 ? ['Validate the highest-risk driver with the workstream owner.', 'Prioritise intervention on the first downstream dependency in the blast radius.'] : ['Maintain monitoring and refresh metrics when new project data is available.'],
    strategic_shifts: activeMitigations.length > 0 ? ['Compare mitigation effectiveness across alternative resource, supplier, schedule, or budget rebalancing options.'] : ['Consider adding mitigation levers for budget, supplier, schedule, or operational rebalancing.'],
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
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned) as NarrativeResponse;

    if (!parsed.executive_summary || !parsed.active_pathway || !parsed.key_drivers) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as NarrativeRequestBody;
    const { node, simulationState: state, simulationDelta: delta } = body;
    const nodeData = node.data;

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
        business_context_clues: businessContextClues
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
      }
    };

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({
        narrative: buildFallbackNarrative(nodeData, state, criDelta),
        source: 'fallback'
      });
    }

    const systemPrompt = `You are Project Spider's Strategist AI.

Your role:
- Explain risk output in brutally direct, highly-specific executive language.
- Provide actionable tactical steps.
- ZERO generic buzzwords. ZERO management consulting fluff. 

Strict Rules for Tactical Actions:
- You MUST name specific entities if provided in the payload (e.g. Work Package Name, downstream impacted counts).
- You MUST explicitly reference the numerical data (e.g. "£1.2M exposure", "delay by 15 days").
- Do NOT say "collaborate with stakeholders". Say "Resolve compliance block on upstream contract to relieve Cost risk."
- Make the actions sound like precise engineering or operational directives.

Business-context rules:
- We do not use top-down personas anymore. Rely ONLY on the exact financial and schedule metrics provided in the payload.

Return ONLY valid JSON with this exact shape:
{
  "executive_summary": "2-3 concise sentences on current risk posture and why it matters.",
  "active_pathway": "A concise pathway such as Supplier → Delivery → Cost, or 'No active multi-step pathway detected'.",
  "propagation_confidence": "Low | Medium | High",
  "key_drivers": ["Driver 1", "Driver 2", "Driver 3"],
  "blast_radius": "Plain-English explanation of connected exposure using only supplied numbers.",
  "residual_risk_view": "How mitigations change or fail to change the remaining risk.",
  "business_context_view": "Inferred or supplied business context and why this risk matters beyond the local WP.",
  "inferred_strategic_objective": "A cautious inferred objective, or the supplied objective if available.",
  "benefit_preservation_view": "Whether accepting cost/schedule trade-offs may be justified to preserve wider programme benefits.",
  "context_confidence": "Low | Medium | High",
  "tactical_actions": ["Immediate action 1", "Immediate action 2"],
  "strategic_shifts": ["Portfolio or operating model adjustment 1", "Longer-term adjustment 2"],
  "assumptions_and_limits": ["Limit 1", "Limit 2"]
}`;

    const userPrompt = `Analyze this deterministic Project Spider payload.

Important:
- Explain and contextualize only; do not recalculate.
- Use business-context inference only as labelled assumptions.
- Make the output feel like a business-aware infrastructure risk interpretation, not a generic risk summary.

${JSON.stringify(deterministicPayload, null, 2)}`;

    const result = await generateText({
      model: google('gemini-1.5-flash'),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.25
    });

    const parsed = safeJsonParse(result.text);

    if (!parsed) {
      return NextResponse.json({
        narrative: buildFallbackNarrative(nodeData, state, criDelta),
        source: 'fallback_after_invalid_ai_json',
        raw_model_output: result.text
      });
    }

    return NextResponse.json({ narrative: parsed, source: 'gemini' });
  } catch (error) {
    console.error('Narrative API Error:', error);
    return NextResponse.json({ error: 'Failed to generate narrative' }, { status: 500 });
  }
}
