"""
Project Spider — JSON Export & Scenario Builder
Assembles state.json from computed risk data.
"""
import json
import os
import networkx as nx
import pandas as pd
import numpy as np
from datetime import datetime


def severity_score(risk_class):
    """Convert risk class to numeric score (0-1 range)."""
    return {'High': 0.85, 'Medium': 0.55, 'Low': 0.20}.get(risk_class, 0.20)


def severity_label(risk_class):
    """Convert risk class to severity label for UI."""
    return {'High': 'critical', 'Medium': 'high', 'Low': 'low'}.get(risk_class, 'low')


def safe_val(v, default=None):
    """Safely convert numpy/pandas values to JSON-safe Python types."""
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return default
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return round(float(v), 2)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, pd.Timestamp):
        return v.isoformat() if not pd.isna(v) else default
    return v


def build_portfolio_risk(wp_master):
    """Build the portfolioRisk / riskIndex section."""
    def pillar_stats(class_col, label, icon):
        counts = wp_master[class_col].value_counts()
        high = int(counts.get('High', 0))
        med = int(counts.get('Medium', 0))
        low = int(counts.get('Low', 0))
        total = high + med + low
        score = round((high * 0.85 + med * 0.55 + low * 0.20) / max(total, 1), 2)
        sev = 'critical' if score >= 0.65 else ('high' if score >= 0.45 else 'low')
        return {
            'label': label,
            'icon': icon,
            'overallScore': score,
            'severity': sev,
            'activeAlerts': high + med,
            'breakdown': {'high': high, 'medium': med, 'low': low}
        }

    return {
        'delivery': pillar_stats('delivery_risk_class', 'Delivery & Operational Risk', 'Clock'),
        'cost': pillar_stats('cost_risk_class', 'Cost & Cashflow Risk', 'DollarSign'),
        'supplier': pillar_stats('supplier_risk_class', 'Supplier & Contract Risk', 'ShoppingCart'),
    }


def build_nodes(wp_master, ms_df, contracts_df):
    """Build React Flow nodes from WP master + milestones + contracts."""
    nodes = []

    # WP nodes
    for _, row in wp_master.iterrows():
        wp_id = row['WorkPackageID']
        nodes.append({
            'id': wp_id,
            'type': 'workPackage',
            'data': {
                'label': f"{wp_id}: {row.get('WorkPackageName', '')}",
                'subtitle': f"{row.get('ProjectType', '')} · {row.get('Location', '')}",
                'status': safe_val(row.get('Status', ''), ''),
                'priority': safe_val(row.get('Priority', ''), ''),
                'riskScore': round(severity_score(row.get('overall_risk_class', 'Low')), 2),
                'severity': severity_label(row.get('overall_risk_class', 'Low')),
                'metrics': {
                    'completionPct': safe_val(row.get('CompletionPercentage'), 0),
                    'plannedCost': safe_val(row.get('PlannedCost'), 0),
                    'actualCost': safe_val(row.get('ActualCost'), 0),
                    'budgetVariance': safe_val(row.get('BudgetVariance'), 0),
                    'cpi': safe_val(row.get('CPI'), None),
                    'spi': safe_val(row.get('SPI'), None),
                },
                'deliveryRisk': {
                    'class': row.get('delivery_risk_class', 'Low'),
                    'driver': row.get('delivery_risk_driver', ''),
                    'subComponents': {
                        'milestoneDelay': {'class': row.get('ms_risk_class', 'Low'), 'driver': row.get('ms_risk_driver', '')},
                        'completionSlippage': {'class': row.get('slip_risk_class', 'Low'), 'driver': row.get('slip_risk_driver', '')},
                        'soBacklog': {'class': row.get('backlog_risk_class', 'Low'), 'driver': row.get('backlog_risk_driver', '')},
                        'operational': {'class': row.get('ops_risk_class', 'Low'), 'driver': row.get('ops_risk_driver', '')},
                    }
                },
                'costRisk': {
                    'class': row.get('cost_risk_class', 'Low'),
                    'driver': row.get('cost_risk_driver', ''),
                    'subComponents': {
                        'costVariance': {'class': row.get('cost_var_class', 'Low'), 'driver': row.get('cost_var_driver', '')},
                        'cpiSpi': {'class': row.get('cpi_spi_class', 'Low'), 'driver': row.get('cpi_spi_driver', '')},
                        'cashflow': {'class': row.get('cf_risk_class', 'Low'), 'driver': row.get('cf_risk_driver', '')},
                    }
                },
                'supplierRisk': {
                    'class': row.get('supplier_risk_class', 'Low'),
                    'driver': row.get('supplier_risk_driver', ''),
                    'subComponents': {
                        'concentration': {'class': row.get('conc_risk_class', 'Low'), 'driver': row.get('conc_risk_driver', '')},
                        'performance': {'class': row.get('perf_risk_class', 'Low'), 'driver': row.get('perf_risk_driver', '')},
                    }
                },
                'owner': safe_val(row.get('ProjectManager', ''), ''),
                'contractorId': safe_val(row.get('ContractorID', ''), ''),
            },
            'position': {'x': 0, 'y': 0}  # Will be set by layout
        })

    # Milestone nodes (only delayed/at-risk ones for visual clarity)
    interesting_ms = ms_df[ms_df['Status'].isin(['Delayed', 'At Risk'])].copy()
    for _, row in interesting_ms.iterrows():
        ms_id = row['MilestoneID']
        delay = safe_val(row.get('DelayDays'), 0)
        nodes.append({
            'id': ms_id,
            'type': 'milestone',
            'data': {
                'label': safe_val(row.get('MilestoneName', ms_id), ms_id),
                'subtitle': f"{row.get('WorkPackageID', '')} · {row.get('MilestoneType', '')}",
                'status': safe_val(row.get('Status', ''), ''),
                'riskScore': 0.88 if row['Status'] == 'Delayed' else 0.65,
                'severity': 'critical' if row['Status'] == 'Delayed' else 'high',
                'metrics': {
                    'plannedDate': safe_val(row.get('PlannedDate'), ''),
                    'forecastDate': safe_val(row.get('ForecastDate'), ''),
                    'delayDays': delay if delay else 0,
                    'isCritical': safe_val(row.get('IsCritical'), False),
                },
                'workPackageId': safe_val(row.get('WorkPackageID'), ''),
            },
            'position': {'x': 0, 'y': 0}
        })

    # Contract nodes (only non-compliant/at-risk)
    risky_contracts = contracts_df[
        contracts_df['ComplianceStatus'].isin(['Non-Compliant', 'Under Review', 'Pending'])
    ].copy()
    for _, row in risky_contracts.iterrows():
        ct_id = row['ContractID']
        nodes.append({
            'id': ct_id,
            'type': 'contract',
            'data': {
                'label': f"{row.get('ContractNumber', ct_id)} · {row.get('SupplierName', '')}",
                'subtitle': f"{row.get('ContractType', '')} · £{safe_val(row.get('ContractValue', 0), 0):,.0f}",
                'status': safe_val(row.get('Status', ''), ''),
                'riskScore': 0.91 if row['ComplianceStatus'] == 'Non-Compliant' else 0.65,
                'severity': 'critical' if row['ComplianceStatus'] == 'Non-Compliant' else 'high',
                'metrics': {
                    'contractValue': safe_val(row.get('ContractValue'), 0),
                    'supplierTier': safe_val(row.get('SupplierTier'), ''),
                    'complianceStatus': safe_val(row.get('ComplianceStatus'), ''),
                    'isKeySupplier': str(row.get('IsKeySupplier', '')).lower() in ['true', '1', 'yes'],
                },
                'supplierId': safe_val(row.get('SupplierID'), ''),
                'workPackageId': safe_val(row.get('WorkPackageID'), ''),
            },
            'position': {'x': 0, 'y': 0}
        })

    return nodes


def build_edges(nodes, ms_df, contracts_df):
    """Build React Flow edges from relationships."""
    edges = []
    node_ids = {n['id'] for n in nodes}

    # Contract → WP (funds)
    for _, row in contracts_df.iterrows():
        ct_id = row['ContractID']
        wp_id = row.get('WorkPackageID')
        if ct_id in node_ids and wp_id in node_ids:
            compliance = row.get('ComplianceStatus', '')
            is_risky = compliance in ['Non-Compliant', 'Under Review']
            edges.append({
                'id': f"e-{ct_id}-{wp_id}",
                'source': ct_id,
                'target': wp_id,
                'type': 'causal',
                'data': {
                    'relationship': 'funds',
                    'weight': 0.91 if is_risky else 0.40,
                    'description': f"{compliance} supplier contract"
                },
                'animated': is_risky,
                'style': {'stroke': '#ef4444' if is_risky else '#6366f1'}
            })

    # WP → Milestone (delivers)
    for _, row in ms_df.iterrows():
        ms_id = row['MilestoneID']
        wp_id = row.get('WorkPackageID')
        if ms_id in node_ids and wp_id in node_ids:
            is_delayed = row['Status'] in ['Delayed', 'At Risk']
            edges.append({
                'id': f"e-{wp_id}-{ms_id}",
                'source': wp_id,
                'target': ms_id,
                'type': 'causal',
                'data': {
                    'relationship': 'delivers',
                    'weight': 0.88 if is_delayed else 0.30,
                    'description': f"WP delivers milestone ({row['Status']})"
                },
                'animated': is_delayed,
                'style': {'stroke': '#f97316' if is_delayed else '#a3a3a3'}
            })

    # Milestone → Milestone (dependency chains)
    for _, row in ms_df.iterrows():
        ms_id = row['MilestoneID']
        deps = row.get('Dependencies', '')
        if pd.notna(deps) and deps:
            for dep_id in str(deps).split(','):
                dep_id = dep_id.strip()
                if dep_id in node_ids and ms_id in node_ids:
                    edges.append({
                        'id': f"e-{dep_id}-{ms_id}",
                        'source': dep_id,
                        'target': ms_id,
                        'type': 'causal',
                        'data': {
                            'relationship': 'blocks',
                            'weight': 0.75,
                            'description': 'Milestone dependency'
                        },
                        'animated': True,
                        'style': {'stroke': '#ef4444'}
                    })

    return edges


def compute_layout(nodes, edges):
    """Compute node positions using NetworkX spring layout."""
    G = nx.DiGraph()
    for n in nodes:
        G.add_node(n['id'], node_type=n['type'])
    for e in edges:
        G.add_edge(e['source'], e['target'])

    # Separate WP nodes for better layout
    if len(G.nodes) > 0:
        pos = nx.spring_layout(G, k=3, iterations=80, seed=42, scale=800)
        for n in nodes:
            if n['id'] in pos:
                n['position'] = {
                    'x': round(float(pos[n['id']][0]) + 600, 0),
                    'y': round(float(pos[n['id']][1]) + 400, 0)
                }

    return nodes
# Edge weights for blast radius propagation.
# Higher = stronger causal impact when the source side fails.
EDGE_WEIGHTS = {
    'funds':    1.0,   # contract funds WP → if funding fails, WP halts hard
    'blocks':   0.9,   # milestone gating → direct causal block
    'delivers': 0.6,   # WP delivers milestone → impact is partial
}

# Cumulative impact below this is considered too weak to include in blast radius.
# Tuned so we get a meaningful radius without polluting it with distant ripples.
BLAST_MIN_IMPACT = 0.3

# Hard cap to prevent runaway BFS on dense graphs.
BLAST_MAX_DEPTH = 4


def compute_blast_radius(edges, trigger_id, node_ids):
    """
    Compute the blast radius from a trigger node using weighted bidirectional BFS.

    Walks the graph in both directions because real cascades aren't strictly
    downstream — e.g. a non-compliant supplier (upstream of a WP) takes out
    the WPs it funds, AND the milestones those WPs deliver.

    Edge types are weighted (see EDGE_WEIGHTS); cumulative impact decays
    multiplicatively along each path. Nodes with impact < BLAST_MIN_IMPACT
    are excluded.

    Returns:
        {
          'direct':   [ids reachable in 1 hop with strong edge],
          'indirect': [ids reachable further out, or via weaker edges],
          'all':      [direct + indirect, ordered by impact strength desc],
          'max_depth': int,   # furthest hop count we kept
        }
    """
    if trigger_id not in node_ids:
        return {'direct': [], 'indirect': [], 'all': [], 'max_depth': 0}

    # Build adjacency in both directions. For each (a, b, type):
    #   - downstream[a] gets (b, weight)  ← walking a→b
    #   - upstream[b]  gets (a, weight)   ← walking b→a (contagion back)
    downstream = {}
    upstream = {}
    for e in edges:
        s, t, etype = e['source'], e['target'], e.get('type', 'delivers')
        w = EDGE_WEIGHTS.get(etype, 0.5)
        downstream.setdefault(s, []).append((t, w))
        upstream.setdefault(t, []).append((s, w))

    # BFS from trigger. Track best (highest) cumulative impact for each node;
    # if we reach it again with stronger impact, update.
    best_impact = {trigger_id: 1.0}
    depth_of   = {trigger_id: 0}
    from collections import deque
    queue = deque([trigger_id])
    max_depth_seen = 0

    while queue:
        node = queue.popleft()
        current_impact = best_impact[node]
        current_depth = depth_of[node]
        if current_depth >= BLAST_MAX_DEPTH:
            continue

        # Walk both directions
        neighbors = downstream.get(node, []) + upstream.get(node, [])
        for nbr, edge_weight in neighbors:
            new_impact = current_impact * edge_weight
            if new_impact < BLAST_MIN_IMPACT:
                continue  # too weak to propagate further
            if new_impact > best_impact.get(nbr, 0):
                best_impact[nbr] = new_impact
                depth_of[nbr] = current_depth + 1
                max_depth_seen = max(max_depth_seen, depth_of[nbr])
                queue.append(nbr)

    # Strip the trigger itself; classify the rest
    impacted = {k: v for k, v in best_impact.items()
                if k != trigger_id and k in node_ids}

    direct   = [k for k, v in impacted.items() if depth_of[k] == 1]
    indirect = [k for k, v in impacted.items() if depth_of[k] > 1]

    # Sort each bucket by impact strength (strongest first)
    direct.sort(key=lambda k: -impacted[k])
    indirect.sort(key=lambda k: -impacted[k])

    return {
        'direct': direct,
        'indirect': indirect,
        'all': direct + indirect,
        'max_depth': max_depth_seen,
    }

def build_scenarios(wp_master, nodes, edges, ms_df, contracts_df):
    """Curate 2-3 compelling demo scenarios with blast radius."""
    scenarios = []
    node_ids = {n['id'] for n in nodes}

# Blast radius is computed by compute_blast_radius() below;
    # no plain graph build needed here.

    # Scenario A: Highest overall risk WP (compound failure)
    high_risk_wps = wp_master[wp_master['overall_risk_class'] == 'High'].copy()
    if len(high_risk_wps) > 0:
        # Pick the one with most High sub-components
        risk_cols = ['delivery_risk_class', 'cost_risk_class', 'supplier_risk_class']
        high_risk_wps['high_count'] = high_risk_wps[risk_cols].apply(
            lambda r: (r == 'High').sum(), axis=1)
        worst = high_risk_wps.sort_values('high_count', ascending=False).iloc[0]
        wp_id = worst['WorkPackageID']
        
# Blast radius (weighted bidirectional propagation)
        blast = compute_blast_radius(edges, wp_id, node_ids)
        impacted = blast['all']
        direct = blast['direct']
        
        # Financial exposure
        impacted_wps = wp_master[wp_master['WorkPackageID'].isin(impacted + [wp_id])]
        total_exposure = impacted_wps['PlannedCost'].sum()

        scenarios.append({
            'id': 'scenario-compound-failure',
            'title': f'{wp_id} Compound Risk Failure',
            'triggerNodeId': wp_id,
            'severity': 'critical',
            'summary': (f"{wp_id} ({worst.get('WorkPackageName', '')}) shows High risk across "
                       f"{int(worst['high_count'])} pillars. "
                       f"Blast radius reaches {len(impacted)} downstream entities "
                       f"with £{safe_val(total_exposure, 0):,.0f} total exposure."),
            'blastRadius': {
                'impactedNodeIds': impacted[:10],
                'totalFinancialExposure': safe_val(total_exposure, 0),
                'affectedWorkPackages': len(impacted_wps),
                'maxCascadeDepth': len(impacted),
            },
            'agentAnalysis': {
                'executiveSummary': (f"{wp_id} represents a critical compound failure point. "
                    f"Delivery risk is {worst.get('delivery_risk_class', 'N/A')} "
                    f"({worst.get('delivery_risk_driver', '')}), "
                    f"Cost risk is {worst.get('cost_risk_class', 'N/A')} "
                    f"({worst.get('cost_risk_driver', '')}), "
                    f"Supplier risk is {worst.get('supplier_risk_class', 'N/A')} "
                    f"({worst.get('supplier_risk_driver', '')})."),
                'impactNarrative': [
                    f"**Immediate:** {worst.get('delivery_risk_driver', 'Delivery issues')} threaten project timeline.",
                    f"**Short-term:** {worst.get('cost_risk_driver', 'Cost overruns')} compound budget pressure.",
                    f"**Medium-term:** Cascade impacts {len(impacted)} downstream entities.",
                    f"**Long-term:** Portfolio-level risk escalation if unmitigated."
                ],
                'remediationSteps': [
                    {'id': 'r1', 'priority': 'P0', 'action': f'Immediate project review for {wp_id}',
                     'owner': safe_val(worst.get('ProjectManager', ''), ''), 'riskReduction': 0.35},
                    {'id': 'r2', 'priority': 'P1', 'action': 'Escalate supplier compliance issues',
                     'owner': 'Procurement Lead', 'riskReduction': 0.25},
                    {'id': 'r3', 'priority': 'P1', 'action': 'Re-baseline schedule and cost forecasts',
                     'owner': 'PMO', 'riskReduction': 0.20},
                ],
                'confidenceScore': 0.87,
            }
        })

    # Scenario B: Supplier cascade — find a supplier linked to multiple risky WPs
    ct = contracts_df.dropna(subset=['WorkPackageID']).copy()
    supplier_wp_counts = ct.groupby('SupplierID')['WorkPackageID'].nunique()
    multi_wp_suppliers = supplier_wp_counts[supplier_wp_counts >= 2]
    
    if len(multi_wp_suppliers) > 0:
        # Pick the supplier with most WP links among non-compliant contracts
        risky_ct = ct[ct['ComplianceStatus'].isin(['Non-Compliant', 'Under Review', 'Pending'])]
        if len(risky_ct) > 0:
            supplier_id = risky_ct.groupby('SupplierID')['WorkPackageID'].nunique().idxmax()
            supplier_name = risky_ct[risky_ct['SupplierID'] == supplier_id]['SupplierName'].iloc[0]
            affected_wps = list(risky_ct[risky_ct['SupplierID'] == supplier_id]['WorkPackageID'].unique())
            affected_contracts = list(risky_ct[risky_ct['SupplierID'] == supplier_id]['ContractID'].unique())
            total_value = risky_ct[risky_ct['SupplierID'] == supplier_id]['ContractValue'].sum()

            scenarios.append({
                'id': 'scenario-supplier-cascade',
                'title': f'{supplier_name} Compliance Failure Cascade',
                'triggerNodeId': affected_contracts[0] if affected_contracts[0] in node_ids else affected_wps[0],
                'severity': 'critical',
                'summary': (f"{supplier_name} ({supplier_id}) has compliance issues across "
                           f"{len(affected_contracts)} contracts affecting {len(affected_wps)} work packages. "
                           f"Total contract value at risk: £{safe_val(total_value, 0):,.0f}."),
                'blastRadius': {
                    'impactedNodeIds': affected_wps + affected_contracts,
                    'totalFinancialExposure': safe_val(total_value, 0),
                    'affectedWorkPackages': len(affected_wps),
                    'maxCascadeDepth': 3,
                },
                'agentAnalysis': {
                    'executiveSummary': (f"{supplier_name} represents a supplier concentration risk. "
                        f"Non-compliant status across {len(affected_contracts)} contracts with "
                        f"£{safe_val(total_value, 0):,.0f} total value threatens {len(affected_wps)} work packages."),
                    'impactNarrative': [
                        f"**Immediate:** Compliance suspension freezes payments across {len(affected_contracts)} contracts.",
                        f"**Short-term:** {len(affected_wps)} work packages face resource stoppage.",
                        f"**Medium-term:** Milestone delays cascade through dependency chains.",
                        f"**Long-term:** Alternative supplier mobilization required (est. 4-6 weeks)."
                    ],
                    'remediationSteps': [
                        {'id': 'r1', 'priority': 'P0', 'action': f'48-hour compliance ultimatum to {supplier_name}',
                         'owner': 'Procurement Lead', 'riskReduction': 0.35},
                        {'id': 'r2', 'priority': 'P0', 'action': 'Activate standby supplier for critical WPs',
                         'owner': 'PMO', 'riskReduction': 0.30},
                        {'id': 'r3', 'priority': 'P1', 'action': 'Re-route non-critical WPs to alternate suppliers',
                         'owner': 'Procurement Lead', 'riskReduction': 0.15},
                    ],
                    'confidenceScore': 0.82,
                }
            })

    # Scenario C: Cost/Schedule spiral — WP with both CPI<1 and SPI<1
    dual_fail = wp_master[
        (wp_master['cpi_spi_class'] == 'High') & 
        (wp_master['delivery_risk_class'].isin(['High', 'Medium']))
    ]
    if len(dual_fail) > 0:
        worst_dual = dual_fail.iloc[0]
        wp_id = worst_dual['WorkPackageID']
        
        blast = compute_blast_radius(edges, wp_id, node_ids)
        impacted = blast['all']
        direct = blast['direct']

        scenarios.append({
            'id': 'scenario-cost-schedule-spiral',
            'title': f'{wp_id} Cost-Schedule Spiral',
            'triggerNodeId': wp_id,
            'severity': 'critical',
            'summary': (f"{wp_id} shows dual CPI/SPI failure "
                       f"(CPI={safe_val(worst_dual.get('CPI'), 'N/A')}, SPI={safe_val(worst_dual.get('SPI'), 'N/A')}) "
                       f"combined with delivery risk. Budget at risk: £{safe_val(worst_dual.get('PlannedCost'), 0):,.0f}."),
            'blastRadius': {
                'impactedNodeIds': impacted[:8],
                'totalFinancialExposure': safe_val(worst_dual.get('PlannedCost'), 0),
                'affectedWorkPackages': 1 + len([n for n in impacted if n.startswith('WP-')]),
                'maxCascadeDepth': len(impacted),
            },
            'agentAnalysis': {
                'executiveSummary': (f"{wp_id} is in a cost-schedule death spiral. "
                    f"CPI of {safe_val(worst_dual.get('CPI'), 'N/A')} and SPI of {safe_val(worst_dual.get('SPI'), 'N/A')} "
                    f"indicate both budget and timeline are deteriorating simultaneously."),
                'impactNarrative': [
                    f"**Immediate:** EAC overrun requires budget reallocation.",
                    f"**Short-term:** Schedule compression needed to recover SPI.",
                    f"**Medium-term:** Earned value collapse threatens portfolio metrics.",
                    f"**Long-term:** Board escalation likely if trend continues."
                ],
                'remediationSteps': [
                    {'id': 'r1', 'priority': 'P0', 'action': 'Conduct earned value deep-dive and re-baseline',
                     'owner': safe_val(worst_dual.get('ProjectManager', ''), ''), 'riskReduction': 0.30},
                    {'id': 'r2', 'priority': 'P1', 'action': 'Fast-track critical path activities',
                     'owner': 'Schedule Manager', 'riskReduction': 0.25},
                ],
                'confidenceScore': 0.79,
            }
        })

    return scenarios


def export_state_json(wp_master, data, output_path):
    """Master export function — builds and writes state.json."""
    ms_df = data['ms']
    contracts_df = data['contracts']

    print("Building nodes...")
    nodes = build_nodes(wp_master, ms_df, contracts_df)
    print(f"  {len(nodes)} nodes created")

    print("Building edges...")
    edges = build_edges(nodes, ms_df, contracts_df)
    print(f"  {len(edges)} edges created")

    print("Computing layout...")
    nodes = compute_layout(nodes, edges)

    print("Building scenarios...")
    scenarios = build_scenarios(wp_master, nodes, edges, ms_df, contracts_df)
    print(f"  {len(scenarios)} scenarios curated")

    print("Building portfolio risk index...")
    risk_index = build_portfolio_risk(wp_master)

    state = {
        'meta': {
            'portfolioId': 'PORT-2024-001',
            'generatedAt': datetime.utcnow().isoformat() + 'Z',
            'version': '1.0.0',
            'scenarioCount': len(scenarios),
            'nodeCount': len(nodes),
            'edgeCount': len(edges),
        },
        'riskIndex': risk_index,
        'nodes': nodes,
        'edges': edges,
        'scenarios': scenarios,
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(state, f, indent=2, default=str)

    file_size = os.path.getsize(output_path)
    print(f"\n✅ Exported to {output_path}")
    print(f"   File size: {file_size / 1024:.1f} KB")
    print(f"   Nodes: {len(nodes)}, Edges: {len(edges)}, Scenarios: {len(scenarios)}")

    return state
