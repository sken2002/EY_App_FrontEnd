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
    """Pillar 1.2: Completion Slippage → WP direct"""
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

    def classify(row):
        if row['WPStatusRiskFlag']:
            return 'High', f"Status: {row['Status']}"
        if row['SlippageRatio'] >= 0.15:
            return 'High', f"Slippage ratio {row['SlippageRatio']:.0%}"
        if row['CompletionShortfall'] >= 0.85:
            return 'High', f"Completion shortfall {row['CompletionShortfall']:.0%}"
        if row['SlippageRatio'] > 0:
            return 'Medium', f"Minor slippage ({row['SlippageDays']:.0f} days)"
        if row['CompletionShortfall'] >= 0.40:
            return 'Medium', f"Completion at {(1-row['CompletionShortfall'])*100:.0f}%"
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
        if row['BacklogRatio'] >= 0.80 or row['OnHoldCount'] >= 2:
            return 'High', f"Backlog {row['BacklogRatio']:.0%}, {int(row['OnHoldCount'])} on hold"
        if row['BacklogRatio'] >= 0.50 or row['TotalSO'] >= 3:
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


def compute_cost_variance_risk(wp):
    """Pillar 2.1: Cost Variance Risk → WP direct"""
    wp = wp.copy()
    wp['PlannedCost'] = pd.to_numeric(wp['PlannedCost'], errors='coerce')
    wp['ActualCost'] = pd.to_numeric(wp['ActualCost'], errors='coerce')
    wp['CostVariance'] = wp['ActualCost'] - wp['PlannedCost']
    wp['CostVarianceRatio'] = wp['CostVariance'] / wp['PlannedCost'].replace(0, np.nan)
    wp['CostVarianceRatio'] = wp['CostVarianceRatio'].fillna(0)

    def classify(row):
        cvr = row['CostVarianceRatio']
        if pd.isna(cvr):
            return 'Low', 'No cost data'
        if cvr > 0.10:
            return 'High', f"Cost overrun {cvr:.1%}"
        if cvr > 0.03:
            return 'Medium', f"Minor overrun {cvr:.1%}"
        return 'Low', 'Within budget'

    wp[['cost_var_class', 'cost_var_driver']] = wp.apply(
        lambda r: pd.Series(classify(r)), axis=1)
    
    cols = ['WorkPackageID', 'CostVariance', 'CostVarianceRatio', 'cost_var_class', 'cost_var_driver']
    return wp[cols]


def compute_cpi_spi_risk(cost_perf):
    """Pillar 2.2: CPI/SPI Performance → WP latest period"""
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
        if cpi < 0.9 and spi < 0.9:
            return 'High', f"CPI={cpi:.2f}, SPI={spi:.2f}"
        if cpi < 1.0 or spi < 1.0:
            return 'Medium', f"CPI={cpi:.2f}, SPI={spi:.2f}"
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
        if row['NonCompliantRatio'] >= 0.50 or row.get('PoorRatings', 0) >= 2:
            return 'High', f"{int(row['NonCompliantCount'])} non-compliant, avg score {row['AvgSupplierScore']:.0f}%"
        if row['NonCompliantCount'] >= 1 or (row['AvgSupplierScore'] < 60 if not pd.isna(row['AvgSupplierScore']) else False):
            return 'Medium', f"Score {row['AvgSupplierScore']:.0f}%, {int(row['NonCompliantCount'])} non-compliant"
        return 'Low', 'Suppliers performing well'

    wp_perf[['perf_risk_class', 'perf_risk_driver']] = wp_perf.apply(
        lambda r: pd.Series(classify(r)), axis=1)
    return wp_perf


def compute_final_pillar_risk(row, sub_classes, pillar_name):
    """Given list of sub-component class columns, compute final pillar = max severity."""
    severity_order = {'High': 3, 'Medium': 2, 'Low': 1}
    max_sev = 0
    driver = 'No data'
    for cls_col, drv_col in sub_classes:
        val = row.get(cls_col, 'Low')
        if val is None or pd.isna(val):
            val = 'Low'
        sev = severity_order.get(val, 0)
        if sev > max_sev:
            max_sev = sev
            driver = row.get(drv_col, 'Unknown')
    
    rev_map = {3: 'High', 2: 'Medium', 1: 'Low', 0: 'Low'}
    return rev_map[max_sev], driver


def compute_all_risks(data):
    """
    Master function: compute all risk indicators and merge into WP-level master table.
    Returns wp_master DataFrame.
    """
    wp = data['wp'].copy()
    ms = data['ms'].copy()
    so = data['so'].copy()
    contracts = data['contracts'].copy()
    scores = data['scores'].copy()
    cost_perf = data['cost_perf'].copy()
    cashflow = data['cashflow'].copy()

    # Compute all sub-components
    ms_risk = compute_milestone_delay_risk(ms)
    slip_risk = compute_completion_slippage(wp)
    backlog_risk = compute_so_backlog_risk(so)
    ops_risk = compute_operational_incident_risk(so)
    cost_var = compute_cost_variance_risk(wp)
    cpi_spi = compute_cpi_spi_risk(cost_perf)
    cf_risk = compute_cashflow_risk(cashflow)
    conc_risk = compute_supplier_concentration_risk(contracts)
    perf_risk = compute_supplier_performance_risk(contracts, scores)

    # Merge everything onto WP
    wp_master = wp.copy()
    wp_master = wp_master.merge(ms_risk, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(slip_risk, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(backlog_risk, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(ops_risk, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(cost_var, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(cpi_spi, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(cf_risk, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(conc_risk, on='WorkPackageID', how='left')
    wp_master = wp_master.merge(perf_risk, on='WorkPackageID', how='left')

    # Fill NaN risk classes
    risk_cols = ['ms_risk_class', 'slip_risk_class', 'backlog_risk_class', 'ops_risk_class',
                 'cost_var_class', 'cpi_spi_class', 'cf_risk_class', 'conc_risk_class', 'perf_risk_class']
    for c in risk_cols:
        if c in wp_master.columns:
            wp_master[c] = wp_master[c].fillna('Low')

    driver_cols = ['ms_risk_driver', 'slip_risk_driver', 'backlog_risk_driver', 'ops_risk_driver',
                   'cost_var_driver', 'cpi_spi_driver', 'cf_risk_driver', 'conc_risk_driver', 'perf_risk_driver']
    for c in driver_cols:
        if c in wp_master.columns:
            wp_master[c] = wp_master[c].fillna('No data')

    # Final pillar risks
    delivery_subs = [('ms_risk_class', 'ms_risk_driver'), ('slip_risk_class', 'slip_risk_driver'),
                     ('backlog_risk_class', 'backlog_risk_driver'), ('ops_risk_class', 'ops_risk_driver')]
    cost_subs = [('cost_var_class', 'cost_var_driver'), ('cpi_spi_class', 'cpi_spi_driver'),
                 ('cf_risk_class', 'cf_risk_driver')]
    supplier_subs = [('conc_risk_class', 'conc_risk_driver'), ('perf_risk_class', 'perf_risk_driver')]

    wp_master[['delivery_risk_class', 'delivery_risk_driver']] = wp_master.apply(
        lambda r: pd.Series(compute_final_pillar_risk(r, delivery_subs, 'delivery')), axis=1)
    wp_master[['cost_risk_class', 'cost_risk_driver']] = wp_master.apply(
        lambda r: pd.Series(compute_final_pillar_risk(r, cost_subs, 'cost')), axis=1)
    wp_master[['supplier_risk_class', 'supplier_risk_driver']] = wp_master.apply(
        lambda r: pd.Series(compute_final_pillar_risk(r, supplier_subs, 'supplier')), axis=1)

    # Overall risk = max of 3 pillars
    overall_subs = [('delivery_risk_class', 'delivery_risk_driver'),
                    ('cost_risk_class', 'cost_risk_driver'),
                    ('supplier_risk_class', 'supplier_risk_driver')]
    wp_master[['overall_risk_class', 'overall_risk_driver']] = wp_master.apply(
        lambda r: pd.Series(compute_final_pillar_risk(r, overall_subs, 'overall')), axis=1)

    # Print summary
    print("\n=== RISK SUMMARY ===")
    for col in ['delivery_risk_class', 'cost_risk_class', 'supplier_risk_class', 'overall_risk_class']:
        print(f"\n{col}:")
        print(wp_master[col].value_counts())

    return wp_master
