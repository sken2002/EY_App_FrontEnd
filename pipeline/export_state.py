"""
Project Spider — JSON Export & Scenario Builder
Assembles state.json from computed risk data.
Updated for 6-dimension EY Risk Framework with weighted CRI + trend signals.
"""
import json
import os
import networkx as nx
import pandas as pd
import numpy as np
from datetime import datetime
from compute_risks import DIMENSION_DEFS


def severity_score(risk_class):
    """Convert risk class to numeric score (0-1 range)."""
    return {'High': 0.85, 'Medium': 0.55, 'Low': 0.20, 'No Data': 0.20}.get(risk_class, 0.20)


def severity_label(risk_class):
    """Convert risk class to severity label for UI."""
    return {'High': 'critical', 'Medium': 'high', 'Low': 'low', 'No Data': 'low'}.get(risk_class, 'low')


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


def build_portfolio_risk(wp_master, dq_modifier):
    """Build the riskIndex section with 6 dimensions + compositeRiskIndex."""
    risk_index = {}

    for dim_key, dim_def in DIMENSION_DEFS.items():
        class_col = f'{dim_key}_class'
        score_col = f'{dim_key}_score'

        if class_col not in wp_master.columns:
            continue

        counts = wp_master[class_col].value_counts()
        high = int(counts.get('High', 0))
        med = int(counts.get('Medium', 0))
        low = int(counts.get('Low', 0))
        no_data = int(counts.get('No Data', 0))
        total = high + med + low + no_data

        # Score = average of WP-level dimension scores
        avg_score = round(wp_master[score_col].mean(), 1) if score_col in wp_master.columns else 0

        sev = 'critical' if avg_score >= 70 else ('high' if avg_score >= 45 else 'low')

        dim_entry = {
            'label': dim_def['label'],
            'icon': dim_def['icon'],
            'weight': dim_def['weight'],
            'score': avg_score,
            'severity': sev,
            'activeAlerts': high + med,
            'breakdown': {'high': high, 'medium': med, 'low': low, 'noData': no_data},
        }

        # Add payment rejection rate to cashflow dimension
        if dim_key == 'cashflow':
            if 'RejectionRatio' in wp_master.columns:
                dim_entry['paymentRejectionRate'] = round(wp_master['RejectionRatio'].mean(), 3)

        risk_index[dim_key] = dim_entry

    # Data Quality dimension
    risk_index['dataQuality'] = {
        'label': 'Data Quality',
        'icon': 'Shield',
        'weight': 0.05,
        'confidenceModifier': dq_modifier['confidence'],
        'totalIssues': dq_modifier['totalIssues'],
        'criticalIssues': dq_modifier['criticalIssues'],
        'inventoryScore': dq_modifier['inventoryScore'],
        'issueScore': dq_modifier['issueScore'],
    }

    # Composite Risk Index
    cri_scores = wp_master['cri_score'] if 'cri_score' in wp_master.columns else pd.Series([0])
    avg_cri = round(cri_scores.mean(), 1)
    cri_sev = 'critical' if avg_cri >= 65 else ('high' if avg_cri >= 40 else 'low')
    cri_counts = wp_master['cri_class'].value_counts() if 'cri_class' in wp_master.columns else pd.Series()

    risk_index['compositeRiskIndex'] = {
        'weightedScore': avg_cri,
        'confidence': dq_modifier['confidence'],
        'severity': cri_sev,
        'breakdown': {
            'high': int(cri_counts.get('High', 0)),
            'medium': int(cri_counts.get('Medium', 0)),
            'low': int(cri_counts.get('Low', 0)),
        },
    }

    return risk_index


def build_nodes(wp_master, ms_df, contracts_df):
    """Build React Flow nodes from WP master + milestones + contracts."""
    nodes = []

    # WP nodes
    for _, row in wp_master.iterrows():
        wp_id = row['WorkPackageID']

        # Build 6-dimension risk blocks for this WP
        dimensions = {}
        for dim_key, dim_def in DIMENSION_DEFS.items():
            subs_data = {}
            for cls_col, drv_col in dim_def['subs']:
                # Extract sub-component name from the column name
                sub_name = cls_col.replace('_class', '').replace('_risk', '')
                subs_data[sub_name] = {
                    'class': safe_val(row.get(cls_col, 'Low'), 'Low'),
                    'driver': safe_val(row.get(drv_col, ''), ''),
                }
            dimensions[dim_key] = {
                'score': safe_val(row.get(f'{dim_key}_score'), 20),
                'class': safe_val(row.get(f'{dim_key}_class', 'Low'), 'Low'),
                'driver': safe_val(row.get(f'{dim_key}_driver', ''), ''),
                'subComponents': subs_data,
            }

        # Trend data
        trends = {
            'cpi': safe_val(row.get('cpi_trend'), 'insufficient_data'),
            'spi': safe_val(row.get('spi_trend'), 'insufficient_data'),
            'milestoneDelay': safe_val(row.get('ms_delay_trend'), 'insufficient_data'),
            'backlog': safe_val(row.get('backlog_trend'), 'insufficient_data'),
            'cashflow': safe_val(row.get('cashflow_trend'), 'insufficient_data'),
        }

        nodes.append({
            'id': wp_id,
            'type': 'workPackage',
            'data': {
                'label': f"{wp_id}: {row.get('WorkPackageName', '')}",
                'subtitle': f"{row.get('ProjectType', '')} · {row.get('Location', '')}",
                'status': safe_val(row.get('Status', ''), ''),
                'priority': safe_val(row.get('Priority', ''), ''),
                'riskScore': safe_val(row.get('cri_score', 20), 20),
                'severity': severity_label(row.get('cri_class', 'Low')),
                'metrics': {
                    'completionPct': safe_val(row.get('CompletionPercentage'), 0),
                    'plannedCost': safe_val(row.get('PlannedCost'), 0),
                    'actualCost': safe_val(row.get('ActualCost'), 0),
                    'budgetVariance': safe_val(row.get('BudgetVariance'), 0),
                    'cpi': safe_val(row.get('CPI'), None),
                    'spi': safe_val(row.get('SPI'), None),
                    
                    # Simulation Raw Metrics
                    'delayedProp': safe_val(row.get('DelayedProp'), 0),
                    'avgDelayDays': safe_val(row.get('AvgDelayDays'), 0),
                    'atRiskCount': safe_val(row.get('AtRiskCount'), 0),
                    
                    'slippageRatio': safe_val(row.get('SlippageRatio'), 0),
                    'completionShortfall': safe_val(row.get('CompletionShortfall'), 0),
                    'wpStatusRiskFlag': safe_val(row.get('WPStatusRiskFlag'), False),
                    'pastPlannedEnd': safe_val(row.get('PastPlannedEnd'), False),
                    
                    'backlogRatio': safe_val(row.get('BacklogRatio'), 0),
                    'onHoldCount': safe_val(row.get('OnHoldCount'), 0),
                    'totalSO': safe_val(row.get('TotalSO'), 0),
                    
                    'emergencyCount': safe_val(row.get('EmergencyCount'), 0),
                    'unresolvedCount': safe_val(row.get('UnresolvedCount'), 0),
                    'totalSO_ops': safe_val(row.get('TotalSO_ops'), 0),
                    
                    'vacPct': safe_val(row.get('VAC_pct'), 0),
                    
                    'cashflowDevRatio': safe_val(row.get('CashflowDevRatio'), 0),
                    'rejectionRatio': safe_val(row.get('RejectionRatio'), 0),
                    'rejectedCount': safe_val(row.get('RejectedCount'), 0),
                    
                    'supplierCount': safe_val(row.get('SupplierCount'), 0),
                    'keySupplierSpendShare': safe_val(row.get('KeySupplierSpendShare'), 0),
                    'nonCompliantRatio': safe_val(row.get('NonCompliantRatio'), 0),
                    'avgSupplierScore': safe_val(row.get('AvgSupplierScore'), 100),
                    'poorRatings': safe_val(row.get('PoorRatings'), 0),
                    'nonCompliantCount': safe_val(row.get('NonCompliantCount'), 0),
                },
                'dimensions': dimensions,
                'trends': trends,
                'owner': safe_val(row.get('ProjectManager', ''), ''),
                'contractorId': safe_val(row.get('ContractorID', ''), ''),
            },
            'position': {'x': 0, 'y': 0}
        })

    # Milestone nodes (only delayed/at-risk for visual clarity)
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
                'riskScore': 88 if row['Status'] == 'Delayed' else 65,
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
                'riskScore': 91 if row['ComplianceStatus'] == 'Non-Compliant' else 65,
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


def build_scenarios(wp_master, nodes, edges, ms_df, contracts_df, dq_modifier):
    """Curate 2-3 compelling demo scenarios with blast radius.
    Uses narrative templates from EY framework Sheet 1.
    """
    scenarios = []
    node_ids = {n['id'] for n in nodes}

    # Build graph for blast radius
    G = nx.DiGraph()
    for e in edges:
        G.add_edge(e['source'], e['target'])

    confidence_note = (f"Confidence in this analysis is {dq_modifier['confidence']*100:.0f}%. "
                       f"{dq_modifier['totalIssues']} data quality issues were detected. "
                       f"Risk scores should be interpreted with "
                       f"{'high' if dq_modifier['confidence'] >= 0.8 else 'medium' if dq_modifier['confidence'] >= 0.6 else 'low'} confidence.")

    # Scenario A: Highest CRI WP (compound failure)
    high_cri = wp_master.nlargest(1, 'cri_score')
    if len(high_cri) > 0:
        worst = high_cri.iloc[0]
        wp_id = worst['WorkPackageID']

        blast_nodes = list(nx.descendants(G, wp_id)) if wp_id in G else []
        impacted = [n for n in blast_nodes if n in node_ids]

        impacted_wps = wp_master[wp_master['WorkPackageID'].isin(impacted + [wp_id])]
        total_exposure = impacted_wps['PlannedCost'].sum()

        # Count how many dimensions are High
        high_dims = sum(1 for dk in DIMENSION_DEFS if worst.get(f'{dk}_class') == 'High')

        # Use narrative templates from Sheet 1
        cpi_val = safe_val(worst.get('CPI'), None)
        cpi_narrative = (f"CPI of {cpi_val:.2f} means for every £1 spent, only £{cpi_val:.2f} of value is earned. "
                        if cpi_val and cpi_val < 1 else "")

        scenarios.append({
            'id': 'scenario-compound-failure',
            'title': f'{wp_id} Compound Risk Failure',
            'triggerNodeId': wp_id,
            'severity': 'critical',
            'summary': (f"{wp_id} ({worst.get('WorkPackageName', '')}) shows High risk across "
                       f"{high_dims} dimensions (CRI: {safe_val(worst.get('cri_score'), 0):.0f}/100). "
                       f"Blast radius reaches {len(impacted)} downstream entities "
                       f"with £{safe_val(total_exposure, 0):,.0f} total exposure."),
            'blastRadius': {
                'impactedNodeIds': impacted[:10],
                'totalFinancialExposure': safe_val(total_exposure, 0),
                'affectedWorkPackages': len(impacted_wps),
                'maxCascadeDepth': len(impacted),
            },
            'agentAnalysis': {
                'executiveSummary': (f"{wp_id} represents a critical compound failure point with CRI of "
                    f"{safe_val(worst.get('cri_score'), 0):.0f}/100. {cpi_narrative}"
                    f"{confidence_note}"),
                'impactNarrative': [
                    f"**Immediate:** Schedule risk ({worst.get('schedule_driver', 'delays')}) threatens project timeline.",
                    f"**Short-term:** Cost pressure ({worst.get('costFinancial_driver', 'overruns')}) compounds budget risk.",
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
                'confidenceScore': round(dq_modifier['confidence'] * 0.87, 2),
            }
        })

    # Scenario B: Supplier cascade
    ct = contracts_df.dropna(subset=['WorkPackageID']).copy()
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
                    f"£{safe_val(total_value, 0):,.0f} total value threatens {len(affected_wps)} work packages. "
                    f"{confidence_note}"),
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
                'confidenceScore': round(dq_modifier['confidence'] * 0.82, 2),
            }
        })

    # Scenario C: Cost/Schedule spiral
    dual_fail = wp_master[
        (wp_master['cpi_spi_class'] == 'High') &
        (wp_master['schedule_class'].isin(['High', 'Medium']))
    ] if 'schedule_class' in wp_master.columns else pd.DataFrame()

    if len(dual_fail) > 0:
        worst_dual = dual_fail.iloc[0]
        wp_id = worst_dual['WorkPackageID']

        blast_nodes = list(nx.descendants(G, wp_id)) if wp_id in G else []
        impacted = [n for n in blast_nodes if n in node_ids]

        scenarios.append({
            'id': 'scenario-cost-schedule-spiral',
            'title': f'{wp_id} Cost-Schedule Spiral',
            'triggerNodeId': wp_id,
            'severity': 'critical',
            'summary': (f"{wp_id} shows dual CPI/SPI failure "
                       f"(CPI={safe_val(worst_dual.get('CPI'), 'N/A')}, SPI={safe_val(worst_dual.get('SPI'), 'N/A')}) "
                       f"combined with schedule risk. Budget at risk: £{safe_val(worst_dual.get('PlannedCost'), 0):,.0f}."),
            'blastRadius': {
                'impactedNodeIds': impacted[:8],
                'totalFinancialExposure': safe_val(worst_dual.get('PlannedCost'), 0),
                'affectedWorkPackages': 1 + len([n for n in impacted if n.startswith('WP-')]),
                'maxCascadeDepth': len(impacted),
            },
            'agentAnalysis': {
                'executiveSummary': (f"{wp_id} is in a cost-schedule death spiral. "
                    f"CPI of {safe_val(worst_dual.get('CPI'), 'N/A')} and SPI of {safe_val(worst_dual.get('SPI'), 'N/A')} "
                    f"indicate both budget and timeline are deteriorating simultaneously. "
                    f"{confidence_note}"),
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
                'confidenceScore': round(dq_modifier['confidence'] * 0.79, 2),
            }
        })

    return scenarios


def export_state_json(wp_master, data, output_path, dq_modifier, trends=None):
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

    print("Scenarios removed (moved to client-side inference)...")
    scenarios = []


    print("Building portfolio risk index (6-dimension)...")
    risk_index = build_portfolio_risk(wp_master, dq_modifier)

    state = {
        'meta': {
            'portfolioId': 'PORT-2024-001',
            'generatedAt': datetime.utcnow().isoformat() + 'Z',
            'version': '2.0.0',
            'framework': '6-dimension-weighted-CRI',
            'scenarioCount': len(scenarios),
            'nodeCount': len(nodes),
            'edgeCount': len(edges),
            'dimensions': list(DIMENSION_DEFS.keys()) + ['dataQuality'],
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
    print(f"   Framework: 6-dimension weighted CRI (v2.0)")
    print(f"   CRI: {risk_index['compositeRiskIndex']['weightedScore']}/100 "
          f"(confidence: {dq_modifier['confidence']:.0%})")

    return state
