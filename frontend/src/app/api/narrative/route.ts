import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { WPRiskState } from '@/lib/riskEngine/types';
import { SpiderNodeData } from '@/lib/types';

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
  nodeData: SpiderNodeData;
  state: WPRiskState;
  delta?: { criDelta?: number };
  globalContext?: GlobalContext;
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

/**
 * Small helper to safely read optional node fields without making the API
 * depend too tightly on the exact SpiderNodeData interface.
 */
function getNodeField(nodeData: SpiderNodeData, key: string): unknown {
  return (nodeData as unknown as Record<string, unknown>)?.[key];
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
  globalContext?: GlobalContext
): NarrativeResponse {
  const materialRisks = Object.entries(state.detected ?? {})
    .filter(([_, d]) => d.class === 'High' || d.class === 'Medium')
    .map(([dim, d]) => `${dim}: ${d.class}${d.drivers?.length ? ` (${d.drivers.join(', ')})` : ''}`);

  const activeMitigations = (state.mitigations ?? []).filter(m => m.active).map(m => m.label);
  const impactedCount = state.blastRadius?.impactedNodeIds?.length ?? 0;
  const exposure = state.blastRadius?.totalExposure ?? 0;

  const workstream = String(getNodeField(nodeData, 'group') ?? 'the relevant workstream');
  const location = getNodeField(nodeData, 'location');
  const contextConfidence: NarrativeResponse['context_confidence'] =
    globalContext?.strategicObjective || globalContext?.expectedBenefit ? 'High' : 'Low';

  return {
    executive_summary: `${nodeData.label} shows ${materialRisks.length > 0 ? 'material risk pressure' : 'limited material risk pressure'} under the current deterministic simulation. ${criDelta !== 0 ? `The simulated CRI movement is ${criDelta > 0 ? '+' : ''}${Math.round(criDelta)}.` : 'No material CRI movement is currently detected.'}`,
    active_pathway: materialRisks.length > 0 ? materialRisks.map(r => r.split(':')[0]).join(' → ') : 'No active multi-step pathway detected',
    propagation_confidence: impactedCount >= 3 || materialRisks.some(r => r.includes('High')) ? 'High' : materialRisks.length > 0 ? 'Medium' : 'Low',
    key_drivers: materialRisks.length > 0 ? materialRisks : ['No significant medium/high deterministic triggers detected'],
    blast_radius: `${impactedCount} connected entities are affected, with approximately £${exposure.toLocaleString()} financial exposure.`,
    residual_risk_view: activeMitigations.length > 0 ? `Active mitigations are applied: ${activeMitigations.join(', ')}.` : 'No active mitigation is currently applied, so residual risk remains close to baseline simulation output.',

    business_context_view: `Inferred from available synthetic data, this work package appears connected to ${workstream}${location ? ` in ${location}` : ''}. The business interpretation should be treated as directional because no explicit strategic objective was supplied.`,
    inferred_strategic_objective: globalContext?.strategicObjective ?? 'Inferred objective: preserve delivery continuity and avoid wider programme disruption.',
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
    const { nodeData, state, delta, globalContext } = body;

    if (!nodeData || !state) {
      return NextResponse.json({ error: 'Missing required deterministic state payload' }, { status: 400 });
    }

    const criDelta = delta?.criDelta ?? 0;
    const archetype = globalContext?.archetype ?? 'Infrastructure';
    const horizon = globalContext?.horizon ?? 'Short-term';

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
      supplied_business_context: {
        strategic_objective: globalContext?.strategicObjective ?? null,
        business_priority: globalContext?.businessPriority ?? null,
        expected_benefit: globalContext?.expectedBenefit ?? null,
        value_at_stake: globalContext?.valueAtStake ?? null
      },
      inference_clues: {
        work_package_name: nodeData.label,
        workstream: getNodeField(nodeData, 'group') ?? null,
        location: getNodeField(nodeData, 'location') ?? null,
        priority: getNodeField(nodeData, 'priority') ?? null,
        planned_cost: getNodeField(nodeData, 'plannedCost') ?? getNodeField(nodeData, 'planned_cost') ?? null,
        completion: getNodeField(nodeData, 'completion') ?? getNodeField(nodeData, 'completionPct') ?? null,
        project_archetype: archetype,
        time_horizon: horizon,
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
        project_archetype: archetype,
        time_horizon: horizon,
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
        narrative: buildFallbackNarrative(nodeData, state, criDelta, globalContext),
        source: 'fallback'
      });
    }

    const systemPrompt = `You are Project Spider's AI interpretation layer for an infrastructure risk dashboard.

Your role:
- Explain deterministic risk-engine output in clear executive language.
- Interpret scenario pathways, risk propagation, blast radius, residual risk, and mitigation options.
- Produce governance-style commentary suitable for EY/client review.
- Add business-context interpretation where useful, especially around strategic value, delivery priority, and benefit preservation.

Strict rules:
- Do NOT calculate or invent CRI, thresholds, exposures, impacted nodes, or risk classes.
- Do NOT introduce specific factual project data that is not present in the deterministic payload.
- Treat propagation as probabilistic confidence, not deterministic certainty.
- Keep the distinction between baseline risk, propagation pressure, mitigation, and residual risk clear.
- Use the supplied deterministic payload as the source of truth.

Business-context inference rules:
- The dataset may be synthetic and may not contain explicit strategic objectives.
- You MAY infer plausible qualitative business context from work package name, workstream, location, project archetype, time horizon, active risk pattern, and dependency exposure.
- Clearly label inferred business context as inferred, assumed, or appears to indicate.
- Use cautious language such as "likely", "may", "appears to", and "could support".
- Do NOT invent specific client names, contract terms, regulation names, revenue numbers, benefit amounts, or deadlines unless supplied.
- If context is weak, state that the interpretation is operationally grounded rather than strategically confirmed.

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
        narrative: buildFallbackNarrative(nodeData, state, criDelta, globalContext),
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
