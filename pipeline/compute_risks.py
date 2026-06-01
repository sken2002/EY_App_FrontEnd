"""
Project Spider — Risk Computations
All 9 sub-components across 3 pillars, computed at Work Package level.
"""
import pandas as pd
import numpy as np


def compute_milestone_delay_risk(ms):
    """Pillar 1.1: Milestone Delay Risk → WP aggregate"""
    ms = ms.copy()
    ms['IsDelayed'] = ms['Status'].isin(['Delayed'])
    ms['IsAtRisk'] = ms['Status'].isin(['At Risk'])
    ms['DelayDays'] = pd.to_numeric(ms['DelayDays'], errors='coerce').fillna(0)

    agg = ms.groupby('WorkPackageID').agg(
        TotalMilestones=('MilestoneID', 'count'),
        DelayedCount=('IsDelayed', 'sum'),
        AtRiskCount=('IsAtRisk', 'sum'),
        AvgDelayDays=('DelayDays', 'mean'),
        MaxDelayDays=('DelayDays', 'max'),
    ).reset_index()

    agg['DelayedProp'] = agg['DelayedCount'] / agg['TotalMilestones']
    agg['AtRiskProp'] = agg['AtRiskCount'] / agg['TotalMilestones']

    def classify(row):
        if row['DelayedProp'] >= 0.70:
            return 'High', 'High delay proportion (≥70%)'
        if row['AvgDelayDays'] >= 45 and row['DelayedProp'] >= 0.30:
            return 'High', 'Severe delay days with significant proportion'
        if row['AtRiskCount'] >= 2 and row['DelayedProp'] >= 0.20:
            return 'High', 'Multiple at-risk milestones'
        if row['DelayedProp'] > 0 or row['AvgDelayDays'] > 0 or row['AtRiskCount'] >= 1:
            return 'Medium', 'Delay or at-risk signals present'
        return 'Low', 'No delays detected'

    agg[['ms_risk_class', 'ms_risk_driver']] = agg.apply(
        lambda r: pd.Series(classify(r)), axis=1)
    
    return agg


def compute_completion_slippage(wp):
    """Schedule dimension: Completion Slippage → WP direct"""
    wp = wp.copy()
    wp['EndDate'] = wp['ActualEndDate'].fillna(wp.get('ForecastEndDate', wp['PlannedEndDate']))
    
    # Handle case where EndDate is still NaT
    wp['EndDate'] = wp['EndDate'].fillna(wp['PlannedEndDate'])
    
    wp['SlippageDays'] = (wp['EndDate'] - wp['PlannedEndDate']).dt.days.fillna(0)
    wp['PlannedDuration'] = (wp['PlannedEndDate'] - wp['PlannedStartDate']).dt.days
    wp['PlannedDuration'] = wp['PlannedDuration'].replace(0, np.nan)
    wp['SlippageRatio'] = wp['SlippageDays'] / wp['PlannedDuration']
    wp['SlippageRatio'] = wp['SlippageRatio'].fillna(0)
    wp['WPStatusRiskFlag'] = wp['Status'].isin(['On Hold', 'Cancelled'])
    wp['CompletionShortfall'] = 1 - wp['CompletionPercentage'].fillna(0) / 100
    # Gate: track whether WP is past its planned end date
    wp['PastPlannedEnd'] = pd.Timestamp.now() > wp['PlannedEndDate']

    def classify(row):
        if row['WPStatusRiskFlag']:
            return 'High', f"Status: {row['Status']}"
        if row['SlippageRatio'] >= 0.15:
            return 'High', f"Slippage ratio {row['SlippageRatio']:.0%}"
        if row['CompletionShortfall'] >= 0.85:
            return 'High', f"Completion shortfall {row['CompletionShortfall']:.0%}"
        if row['SlippageRatio'] > 0:
            return 'Medium', f"Minor slippage ({row['SlippageDays']:.0f} days)"
        # Gate: only flag shortfall if WP is past its planned end date
        if row['CompletionShortfall'] >= 0.40 and row.get('PastPlannedEnd', False):
            return 'Medium', f"Completion at {(1-row['CompletionShortfall'])*100:.0f}% (past planned end)"
        return 'Low', 'On track'

    wp[['slip_risk_class', 'slip_risk_driver']] = wp.apply(
        lambda r: pd.Series(classify(r)), axis=1)
    
    cols = ['WorkPackageID', 'SlippageDays', 'SlippageRatio', 'CompletionShortfall',
            'WPStatusRiskFlag', 'slip_risk_class', 'slip_risk_driver']
    return wp[cols]


def compute_so_backlog_risk(so):
    """Pillar 1.3: Service Order Backlog Risk → WP aggregate"""
    so = so.copy()
    so = so.dropna(subset=['WorkPackageID'])
    so['IsOpen'] = ~so['Status'].isin(['Completed', 'Cancelled'])
    so['IsOnHold'] = so['Status'] == 'On Hold'

    agg = so.groupby('WorkPackageID').agg(
        TotalSO=('ServiceOrderID', 'count'),
        OpenOrders=('IsOpen', 'sum'),
        OnHoldCount=('IsOnHold', 'sum'),
    ).reset_index()

    agg['BacklogRatio'] = agg['OpenOrders'] / agg['TotalSO']

    def classify(row):
        # Gate: require at least 5 service orders before flagging
        if row['TotalSO'] < 5:
            return 'Low', f"Only {int(row['TotalSO'])} orders (below threshold)"
        if row['BacklogRatio'] >= 0.90 or row['OnHoldCount'] >= 3:
            return 'High', f"Backlog {row['BacklogRatio']:.0%}, {int(row['OnHoldCount'])} on hold"
        if row['BacklogRatio'] >= 0.70 or row['OnHoldCount'] >= 2:
            return 'Medium', f"Backlog {row['BacklogRatio']:.0%}"
        return 'Low', 'Manageable backlog'

    agg[['backlog_risk_class', 'backlog_risk_driver']] = agg.apply(
        lambda r: pd.Series(classify(r)), axis=1)
    return agg


def compute_operational_incident_risk(so):
    """Pillar 1.4: Operational Incident Risk → WP aggregate"""
    so = so.copy()
    so = so.dropna(subset=['WorkPackageID'])
    
    is_emergency_col = 'IsEmergency'
    so['EmergencyFlag'] = False
    if 'Priority' in so.columns:
        so['EmergencyFlag'] = so['EmergencyFlag'] | (so['Priority'] == 'Emergency')
    if is_emergency_col in so.columns:
        so[is_emergency_col] = so[is_emergency_col].astype(str).str.lower().isin(['true', '1', 'yes'])
        so['EmergencyFlag'] = so['EmergencyFlag'] | so[is_emergency_col]

    so['UnresolvedFlag'] = so['Status'].isin(['Assigned', 'In Progress', 'On Hold', 'Requested'])

    agg = so.groupby('WorkPackageID').agg(
        EmergencyCount=('EmergencyFlag', 'sum'),
        UnresolvedCount=('UnresolvedFlag', 'sum'),
        TotalSO_ops=('ServiceOrderID', 'count'),
    ).reset_index()

    agg['EmergencyRatio'] = agg['EmergencyCount'] / agg['TotalSO_ops'].replace(0, np.nan)
    agg['EmergencyRatio'] = agg['EmergencyRatio'].fillna(0)

    def classify(row):
        if row['EmergencyCount'] >= 2 or (row['TotalSO_ops'] >= 3 and row['EmergencyRatio'] >= 0.30):
            return 'High', f"{int(row['EmergencyCount'])} emergencies"
        if row['UnresolvedCount'] >= 2 or row['TotalSO_ops'] >= 5:
            return 'Medium', f"{int(row['UnresolvedCount'])} unresolved"
        return 'Low', 'No operational incidents'

    agg[['ops_risk_class', 'ops_risk_driver']] = agg.apply(
        lambda r: pd.Series(classify(r)), axis=1)
    return agg


def compute_cost_variance_risk(wp, cost_perf):
    """Cost & Financial dimension: VAC% Risk → WP level using Stage_CostPerformance.
    Replaces the old ActualCost-PlannedCost ratio which was a dead signal (0% High).
    Uses: VAC% = (BAC - EAC) / BAC from latest cost performance record.
    """
    cp = cost_perf.copy()
    cp = cp.sort_values('RecordDate')
    latest = cp.groupby('WorkPackageID').last().reset_index()

    latest['BudgetAtCompletion'] = pd.to_numeric(latest['BudgetAtCompletion'], errors='coerce')
    latest['EstimateAtCompletion'] = pd.to_numeric(latest['EstimateAtCompletion'], errors='coerce')
    latest['VarianceAtCompletion'] = pd.to_numeric(latest.get('VarianceAtCompletion', pd.Series(dtype=float)), errors='coerce')

    # VAC% = (BAC - EAC) / BAC — negative means overshoot
    latest['VAC_pct'] = (latest['BudgetAtCompletion'] - latest['EstimateAtCompletion']) / latest['BudgetAtCompletion'].replace(0, np.nan)
    latest['VAC_pct'] = latest['VAC_pct'].fillna(0)

    def classify(row):
        vac = row['VAC_pct']
        if pd.isna(vac):
            return 'Low', 'No cost performance data'
        if vac < -0.10:
            return 'High', f"EAC overshoots BAC by {abs(vac):.1%}"
        if vac < -0.05:
            return 'Medium', f"EAC exceeds BAC by {abs(vac):.1%}"
        return 'Low', f"VAC within tolerance ({vac:.1%})"

    latest[['cost_var_class', 'cost_var_driver']] = latest.apply(
        lambda r: pd.Series(classify(r)), axis=1)

    cols = ['WorkPackageID', 'VAC_pct', 'BudgetAtCompletion', 'EstimateAtCompletion',
            'cost_var_class', 'cost_var_driver']
    return latest[[c for c in cols if c in latest.columns]]


def compute_cpi_spi_risk(cost_perf):
    """Cost & Financial dimension: CPI/SPI Performance → WP latest period"""
    cp = cost_perf.copy()
    cp = cp.sort_values('RecordDate')
    latest = cp.groupby('WorkPackageID').last().reset_index()

    latest['CPI'] = pd.to_numeric(latest['CPI'], errors='coerce')
    latest['SPI'] = pd.to_numeric(latest['SPI'], errors='coerce')

    def classify(row):
        cpi = row.get('CPI', None)
        spi = row.get('SPI', None)
        if pd.isna(cpi) or pd.isna(spi):
            return 'Low', 'No CPI/SPI data'
        # Contradiction flag: PerformanceStatus says On Track but CPI tells a different story
        contradiction = ''
        perf_status = row.get('PerformanceStatus', '')
        if perf_status == 'On Track' and cpi < 0.9:
            contradiction = ' ⚠ CONTRADICTION: Status reports On Track'
        if cpi < 0.9 and spi < 0.9:
            return 'High', f"CPI={cpi:.2f}, SPI={spi:.2f}{contradiction}"
        if cpi < 1.0 or spi < 1.0:
            return 'Medium', f"CPI={cpi:.2f}, SPI={spi:.2f}{contradiction}"
        return 'Low', f"CPI={cpi:.2f}, SPI={spi:.2f}"

    latest[['cpi_spi_class', 'cpi_spi_driver']] = latest.apply(
        lambda r: pd.Series(classify(r)), axis=1)

    cols = ['WorkPackageID', 'CPI', 'SPI', 'EarnedValue', 'BudgetAtCompletion',
            'EstimateAtCompletion', 'PerformanceStatus', 'cpi_spi_class', 'cpi_spi_driver']
    return latest[[c for c in cols if c in latest.columns]]


def compute_cashflow_risk(cashflow):
    """Pillar 2.3: Cashflow Risk → WP aggregate"""
    cf = cashflow.copy()
    
    # Separate planned vs actual by CashflowType
    planned = cf[cf['CashflowType'] == 'Planned'].copy()
    actual = cf[cf['CashflowType'] == 'Actual'].copy()

    planned_agg = planned.groupby('WorkPackageID').agg(
        PlannedTotal=('Amount', 'sum')
    ).reset_index()

    actual_agg = actual.groupby('WorkPackageID').agg(
        ActualTotal=('Amount', 'sum')
    ).reset_index()

    merged = planned_agg.merge(actual_agg, on='WorkPackageID', how='outer')
    merged = merged.fillna(0)
    merged['CashflowDevRatio'] = (merged['ActualTotal'] - merged['PlannedTotal']) / merged['PlannedTotal'].replace(0, np.nan)
    merged['CashflowDevRatio'] = merged['CashflowDevRatio'].fillna(0)

    def classify(row):
        dev = abs(row['CashflowDevRatio'])
        if dev > 0.15:
            return 'High', f"Cashflow deviation {row['CashflowDevRatio']:.1%}"
        if dev > 0.05:
            return 'Medium', f"Minor cashflow deviation {row['CashflowDevRatio']:.1%}"
        return 'Low', 'Cashflow on track'

    merged[['cf_risk_class', 'cf_risk_driver']] = merged.apply(
        lambda r: pd.Series(classify(r)), axis=1)
    return merged


def compute_supplier_concentration_risk(contracts):
    """Pillar 3.1: Supplier Concentration → WP level"""
    ct = contracts.copy()
    ct = ct.dropna(subset=['WorkPackageID'])
    ct['ContractValue'] = pd.to_numeric(ct['ContractValue'], errors='coerce').fillna(0)
    ct['IsKeySupplier'] = ct['IsKeySupplier'].astype(str).str.lower().isin(['true', '1', 'yes'])

    agg = ct.groupby('WorkPackageID').agg(
        TotalContractValue=('ContractValue', 'sum'),
        SupplierCount=('SupplierID', 'nunique'),
        ContractCount=('ContractID', 'count'),
    ).reset_index()

    # Key supplier value
    key_vals = ct[ct['IsKeySupplier']].groupby('WorkPackageID')['ContractValue'].sum().reset_index()
    key_vals.columns = ['WorkPackageID', 'KeySupplierValue']
    agg = agg.merge(key_vals, on='WorkPackageID', how='left')
    agg['KeySupplierValue'] = agg['KeySupplierValue'].fillna(0)
    agg['KeySupplierSpendShare'] = agg['KeySupplierValue'] / agg['TotalContractValue'].replace(0, np.nan)
    agg['KeySupplierSpendShare'] = agg['KeySupplierSpendShare'].fillna(0)

    def classify(row):
        if row['SupplierCount'] == 1:
            return 'High', 'Single supplier (SPOF)'
        if row['KeySupplierSpendShare'] >= 0.70:
            return 'High', f"Key supplier spend share {row['KeySupplierSpendShare']:.0%}"
        if row['SupplierCount'] <= 2 or row['KeySupplierSpendShare'] >= 0.50:
            return 'Medium', f"{int(row['SupplierCount'])} suppliers"
        return 'Low', 'Diversified supply base'

    agg[['conc_risk_class', 'conc_risk_driver']] = agg.apply(
        lambda r: pd.Series(classify(r)), axis=1)

    # WPs with no contract data → 'No Data' (not false Low)
    return agg


def compute_supplier_performance_risk(contracts, scores):
    """Pillar 3.2: Supplier Performance → WP level via contracts"""
    sc = scores.copy()
    sc = sc.sort_values('ScoreDate')
    
    # Get latest score per supplier-contract-category
    latest = sc.groupby(['SupplierID', 'ContractID', 'ScoreCategory']).last().reset_index()
    
    # Average score per contract
    contract_scores = latest.groupby('ContractID').agg(
        AvgScorePct=('ScorePercentage', 'mean'),
        MinScore=('ScorePercentage', 'min'),
        PoorRatingCount=('Rating', lambda x: (x.isin(['Poor', 'Unsatisfactory'])).sum()),
    ).reset_index()

    # Join to contracts to get WP mapping
    ct = contracts[['ContractID', 'WorkPackageID', 'SupplierID', 'ComplianceStatus', 'SupplierTier']].copy()
    ct = ct.dropna(subset=['WorkPackageID'])
    ct = ct.merge(contract_scores, on='ContractID', how='left')
    
    ct['NonCompliant'] = ct['ComplianceStatus'].isin(['Non-Compliant', 'Under Review', 'Pending'])

    # Aggregate to WP
    wp_perf = ct.groupby('WorkPackageID').agg(
        AvgSupplierScore=('AvgScorePct', 'mean'),
        MinSupplierScore=('MinScore', 'min'),
        NonCompliantCount=('NonCompliant', 'sum'),
        TotalContracts_perf=('ContractID', 'count'),
        PoorRatings=('PoorRatingCount', 'sum'),
    ).reset_index()

    wp_perf['NonCompliantRatio'] = wp_perf['NonCompliantCount'] / wp_perf['TotalContracts_perf'].replace(0, np.nan)
    wp_perf['NonCompliantRatio'] = wp_perf['NonCompliantRatio'].fillna(0)

    def classify(row):
        avg_score = row['AvgSupplierScore'] if not pd.isna(row['AvgSupplierScore']) else 100
        # Tighter thresholds: require BOTH high NCR AND low score for High
        if row['NonCompliantRatio'] >= 0.75 and avg_score < 50:
            return 'High', f"{int(row['NonCompliantCount'])} non-compliant, avg score {avg_score:.0f}%"
        if row.get('PoorRatings', 0) >= 2 and row['NonCompliantRatio'] >= 0.50:
            return 'High', f"{int(row.get('PoorRatings', 0))} poor ratings, NCR {row['NonCompliantRatio']:.0%}"
        if row['NonCompliantRatio'] >= 0.50 or avg_score < 60:
            return 'Medium', f"Score {avg_score:.0f}%, {int(row['NonCompliantCount'])} non-compliant"
        if row['NonCompliantCount'] >= 1:
            return 'Medium', f"{int(row['NonCompliantCount'])} non-compliant contract(s)"
        return 'Low', 'Suppliers performing well'

    wp_perf[['perf_risk_class', 'perf_risk_driver']] = wp_perf.apply(
        lambda r: pd.Series(classify(r)), axis=1)
    return wp_perf


def compute_payment_rejection_risk(cashflow):
    """Cashflow dimension: Payment Rejection Rate per WP.
    New sub-component — PaymentStatus='Rejected' records in Stage_Cashflow.
    """
    cf = cashflow.copy()
    agg = cf.groupby('WorkPackageID').agg(
        TotalCashflowRecords=('CashflowID', 'count'),
        RejectedCount=('PaymentStatus', lambda x: (x == 'Rejected').sum()),
    ).reset_index()

    agg['RejectionRatio'] = agg['RejectedCount'] / agg['TotalCashflowRecords'].replace(0, np.nan)
    agg['RejectionRatio'] = agg['RejectionRatio'].fillna(0)

    def classify(row):
        if row['RejectionRatio'] >= 0.20:
            return 'High', f"{int(row['RejectedCount'])} rejections ({row['RejectionRatio']:.0%} rate)"
        if row['RejectionRatio'] >= 0.10:
            return 'Medium', f"{int(row['RejectedCount'])} rejections ({row['RejectionRatio']:.0%} rate)"
        return 'Low', 'Low rejection rate'

    agg[['pmt_reject_class', 'pmt_reject_driver']] = agg.apply(
        lambda r: pd.Series(classify(r)), axis=1)
    return agg


def compute_data_quality_modifier(dq_issues, data_inventory):
    """Data Quality dimension: portfolio-level confidence modifier (0.0–1.0).
    Scales UP the final CRI when data quality is poor (penalty).
    """
    # Score from DataQualityIssues: severity distribution
    severity_weights = {'Critical': 1.0, 'High': 0.7, 'Medium': 0.4, 'Low': 0.1}
    if 'Severity' in dq_issues.columns and len(dq_issues) > 0:
        dq_issues['SevWeight'] = dq_issues['Severity'].map(severity_weights).fillna(0.3)
        # Resolved issues count less
        if 'Status' in dq_issues.columns:
            dq_issues['SevWeight'] = dq_issues.apply(
                lambda r: r['SevWeight'] * 0.3 if r.get('Status') == 'Resolved' else r['SevWeight'], axis=1)
        issue_penalty = dq_issues['SevWeight'].sum()
        max_penalty = len(dq_issues) * 1.0  # worst case: all Critical, all open
        issue_score = 1.0 - min(issue_penalty / max(max_penalty, 1), 1.0)
    else:
        issue_score = 1.0

    # Score from DataInventory: quality level distribution
    quality_scores = {'Excellent': 1.0, 'Good': 0.8, 'Fair': 0.5, 'Poor': 0.2, 'Critical Issues': 0.0}
    if 'DataQualityLevel' in data_inventory.columns and len(data_inventory) > 0:
        data_inventory['QScore'] = data_inventory['DataQualityLevel'].map(quality_scores).fillna(0.5)
        inventory_score = data_inventory['QScore'].mean()
    else:
        inventory_score = 1.0

    # Combined confidence = average of both signals
    confidence = round((issue_score * 0.6 + inventory_score * 0.4), 3)
    confidence = max(0.3, min(1.0, confidence))  # Floor at 0.3 to avoid zero-ing out CRI

    total_issues = len(dq_issues)
    critical_issues = len(dq_issues[dq_issues.get('Severity', pd.Series()) == 'Critical']) if 'Severity' in dq_issues.columns else 0

    return {
        'confidence': confidence,
        'totalIssues': int(total_issues),
        'criticalIssues': int(critical_issues),
        'inventoryScore': round(inventory_score, 3),
        'issueScore': round(issue_score, 3),
    }


def compute_dimension_score(row, sub_classes):
    """Compute a dimension score (0–100) as weighted average of sub-component severities.
    Also returns the worst driver and the dimension risk class.
    """
    severity_scores = {'High': 85, 'Medium': 55, 'Low': 20, 'No Data': 20}
    severity_order = {'High': 3, 'Medium': 2, 'Low': 1, 'No Data': 0}

    total_score = 0
    count = 0
    max_sev = 0
    worst_driver = 'No data'

    for cls_col, drv_col in sub_classes:
        val = row.get(cls_col, 'Low')
        if val is None or (isinstance(val, float) and pd.isna(val)):
            val = 'Low'
        total_score += severity_scores.get(val, 20)
        count += 1
        sev = severity_order.get(val, 0)
        if sev > max_sev:
            max_sev = sev
            worst_driver = row.get(drv_col, 'Unknown')

    avg_score = round(total_score / max(count, 1), 1)
    # Classify based on average score
    if avg_score >= 70:
        risk_class = 'High'
    elif avg_score >= 40:
        risk_class = 'Medium'
    else:
        risk_class = 'Low'

    return avg_score, risk_class, worst_driver


# ---------------------------------------------------------------------------
# 6-DIMENSION DEFINITIONS (weights from EY framework)
# ---------------------------------------------------------------------------
DIMENSION_DEFS = {
    'costFinancial': {
        'weight': 0.25,
        'label': 'Cost & Financial',
        'icon': 'DollarSign',
        'subs': [('cost_var_class', 'cost_var_driver'), ('cpi_spi_class', 'cpi_spi_driver')],
    },
    'cashflow': {
        'weight': 0.20,
        'label': 'Cashflow',
        'icon': 'Banknote',
        'subs': [('cf_risk_class', 'cf_risk_driver'), ('pmt_reject_class', 'pmt_reject_driver')],
    },
    'schedule': {
        'weight': 0.20,
        'label': 'Schedule',
        'icon': 'Clock',
        'subs': [('ms_risk_class', 'ms_risk_driver'), ('slip_risk_class', 'slip_risk_driver')],
    },
    'operational': {
        'weight': 0.10,
        'label': 'Operational',
        'icon': 'Activity',
        'subs': [('backlog_risk_class', 'backlog_risk_driver'), ('ops_risk_class', 'ops_risk_driver')],
    },
    'supplier': {
        'weight': 0.20,
        'label': 'Supplier & Contract',
        'icon': 'ShoppingCart',
        'subs': [('conc_risk_class', 'conc_risk_driver'), ('perf_risk_class', 'perf_risk_driver')],
    },
}

DIMENSION_WEIGHTS = {k: v['weight'] for k, v in DIMENSION_DEFS.items()}


def compute_all_risks(data):
    """
    Master function: compute all risk indicators and merge into WP-level master table.
    Returns (wp_master, dq_modifier) — wp_master has 6-dimension scores, dq_modifier is portfolio-level.
    """
    wp = data['wp'].copy()
    ms = data['ms'].copy()
    so = data['so'].copy()
    contracts = data['contracts'].copy()
    scores = data['scores'].copy()
    cost_perf = data['cost_perf'].copy()
    cashflow = data['cashflow'].copy()
    dq_issues = data.get('dq_issues', pd.DataFrame())
    data_inventory = data.get('data_inventory', pd.DataFrame())

    # ── Compute all sub-components ──
    ms_risk = compute_milestone_delay_risk(ms)
    slip_risk = compute_completion_slippage(wp)
    backlog_risk = compute_so_backlog_risk(so)
    ops_risk = compute_operational_incident_risk(so)
    cost_var = compute_cost_variance_risk(wp, cost_perf)  # NEW: uses VAC%
    cpi_spi = compute_cpi_spi_risk(cost_perf)
    cf_risk = compute_cashflow_risk(cashflow)
    pmt_risk = compute_payment_rejection_risk(cashflow)   # NEW
    conc_risk = compute_supplier_concentration_risk(contracts)
    perf_risk = compute_supplier_performance_risk(contracts, scores)

    # ── Data Quality modifier (portfolio-level) ──
    dq_modifier = compute_data_quality_modifier(dq_issues, data_inventory)
    print(f"  Data Quality confidence modifier: {dq_modifier['confidence']}")

    # ── Merge everything onto WP ──
    wp_master = wp.copy()
    wp_master = wp_master.merge(ms_risk, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(slip_risk, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(backlog_risk, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(ops_risk, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(cost_var, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(cpi_spi, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(cf_risk, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(pmt_risk, on='WorkPackageID', how='left')  # NEW
    wp_master = wp_master.merge(conc_risk, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(perf_risk, on='WorkPackageID', how='left')

    # ── Fill NaN risk classes ──
    risk_cols = ['ms_risk_class', 'slip_risk_class', 'backlog_risk_class', 'ops_risk_class',
                 'cost_var_class', 'cpi_spi_class', 'cf_risk_class', 'pmt_reject_class',
                 'conc_risk_class', 'perf_risk_class']
    for c in risk_cols:
        if c in wp_master.columns:
            wp_master[c] = wp_master[c].fillna('Low')

    # Handle supplier concentration 'No Data' for WPs without contracts
    if 'conc_risk_class' in wp_master.columns:
        no_contract_mask = wp_master['conc_risk_class'] == 'Low'
        if 'SupplierCount' in wp_master.columns:
            no_data_mask = wp_master['SupplierCount'].isna()
            wp_master.loc[no_data_mask, 'conc_risk_class'] = 'No Data'
            wp_master.loc[no_data_mask, 'conc_risk_driver'] = 'No contract data — unassessed'

    driver_cols = ['ms_risk_driver', 'slip_risk_driver', 'backlog_risk_driver', 'ops_risk_driver',
                   'cost_var_driver', 'cpi_spi_driver', 'cf_risk_driver', 'pmt_reject_driver',
                   'conc_risk_driver', 'perf_risk_driver']
    for c in driver_cols:
        if c in wp_master.columns:
            wp_master[c] = wp_master[c].fillna('No data')

    # ── 6-Dimension scoring (replaces old 3-pillar max logic) ──
    for dim_key, dim_def in DIMENSION_DEFS.items():
        subs = dim_def['subs']
        def compute_dim(r):
            s, c, d = compute_dimension_score(r, subs)
            return pd.Series([s, c, d])
        wp_master[[f'{dim_key}_score', f'{dim_key}_class', f'{dim_key}_driver']] = wp_master.apply(
            lambda r: compute_dim(r), axis=1)

    # ── Perfect Average CRI per WP ──
    def compute_cri(row):
        cri_raw = 0
        for dim_key in DIMENSION_DEFS.keys():
            score = row.get(f'{dim_key}_score', 20)
            cri_raw += score
        
        cri_final = round(cri_raw / 5, 1)
        return cri_final

    wp_master['cri_score'] = wp_master.apply(compute_cri, axis=1)

    # Classify CRI
    def classify_cri(score):
        if score >= 65:
            return 'High'
        if score >= 40:
            return 'Medium'
        return 'Low'

    wp_master['cri_class'] = wp_master['cri_score'].apply(classify_cri)

    # ── Print 6-dimension summary ──
    print("\n=== 6-DIMENSION RISK SUMMARY ===")
    for dim_key in DIMENSION_DEFS:
        col = f'{dim_key}_class'
        if col in wp_master.columns:
            print(f"\n{dim_key} ({DIMENSION_DEFS[dim_key]['weight']*100:.0f}%):")
            print(wp_master[col].value_counts())

    print(f"\nComposite Risk Index (CRI):")
    print(wp_master['cri_class'].value_counts())
    print(f"CRI range: {wp_master['cri_score'].min():.1f} – {wp_master['cri_score'].max():.1f}")
    print(f"Data Quality confidence: {dq_modifier['confidence']:.3f}")

    return wp_master, dq_modifier

