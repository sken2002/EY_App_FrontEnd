"""
Project Spider — Trend / Velocity Logic
Adds Improving / Stable / Declining direction signals to 6 key metrics.
Design from EY Risk Framework Sheet 3 — pseudo-logic implemented with proposed defaults.

Team decisions applied (proposed defaults):
  - Minimum periods: 3
  - CPI/SPI trends: kept separate (Option B)
  - Milestone period field: ForecastDate
  - Service order period field: RequestedDate
  - Supplier score window: count-based (last 3 evaluations)
  - Stages: treated as chronological
"""
import pandas as pd
import numpy as np


def _trend_label(delta, threshold):
    """Return trend direction based on delta and threshold."""
    if delta >= threshold:
        return 'improving'
    elif delta <= -threshold:
        return 'declining'
    return 'stable'


def compute_cpi_trend(cost_perf):
    """CPI trend: last 3 periods per WP. Delta = P3.CPI - P1.CPI.
    >+0.05 = Improving, ±0.05 = Stable, <-0.05 = Declining.
    """
    cp = cost_perf.copy()
    cp['CPI'] = pd.to_numeric(cp['CPI'], errors='coerce')
    cp = cp.dropna(subset=['CPI', 'WorkPackageID'])
    cp = cp.sort_values('RecordDate')

    results = []
    for wp_id, group in cp.groupby('WorkPackageID'):
        if len(group) < 3:
            results.append({'WorkPackageID': wp_id, 'cpi_trend': 'insufficient_data',
                           'cpi_trend_delta': None, 'cpi_periods': len(group)})
            continue
        last3 = group.tail(3)
        p1 = last3.iloc[0]['CPI']
        p3 = last3.iloc[-1]['CPI']
        delta = round(p3 - p1, 4)
        results.append({
            'WorkPackageID': wp_id,
            'cpi_trend': _trend_label(delta, 0.05),
            'cpi_trend_delta': delta,
            'cpi_periods': len(group),
        })

    return pd.DataFrame(results) if results else pd.DataFrame(
        columns=['WorkPackageID', 'cpi_trend', 'cpi_trend_delta', 'cpi_periods'])


def compute_spi_trend(cost_perf):
    """SPI trend: same logic as CPI — last 3 periods per WP."""
    cp = cost_perf.copy()
    cp['SPI'] = pd.to_numeric(cp['SPI'], errors='coerce')
    cp = cp.dropna(subset=['SPI', 'WorkPackageID'])
    cp = cp.sort_values('RecordDate')

    results = []
    for wp_id, group in cp.groupby('WorkPackageID'):
        if len(group) < 3:
            results.append({'WorkPackageID': wp_id, 'spi_trend': 'insufficient_data',
                           'spi_trend_delta': None, 'spi_periods': len(group)})
            continue
        last3 = group.tail(3)
        p1 = last3.iloc[0]['SPI']
        p3 = last3.iloc[-1]['SPI']
        delta = round(p3 - p1, 4)
        results.append({
            'WorkPackageID': wp_id,
            'spi_trend': _trend_label(delta, 0.05),
            'spi_trend_delta': delta,
            'spi_periods': len(group),
        })

    return pd.DataFrame(results) if results else pd.DataFrame(
        columns=['WorkPackageID', 'spi_trend', 'spi_trend_delta', 'spi_periods'])


def compute_milestone_delay_trend(ms):
    """Milestone Delay Proportion trend: group by ForecastDate month.
    Compare DelayedProp latest month vs prior month.
    +5pp or more = Declining. -5pp or more = Improving. ±5pp = Stable.
    """
    ms = ms.copy()
    ms['IsDelayed'] = ms['Status'].isin(['Delayed'])
    # Use ForecastDate to assign period (proposed default)
    date_col = 'ForecastDate' if 'ForecastDate' in ms.columns else 'PlannedDate'
    ms['Period'] = pd.to_datetime(ms[date_col], errors='coerce').dt.to_period('M')
    ms = ms.dropna(subset=['Period', 'WorkPackageID'])

    results = []
    for wp_id, group in ms.groupby('WorkPackageID'):
        period_stats = group.groupby('Period').agg(
            total=('MilestoneID', 'count'),
            delayed=('IsDelayed', 'sum'),
        )
        period_stats['delayed_prop'] = period_stats['delayed'] / period_stats['total']
        period_stats = period_stats.sort_index()

        if len(period_stats) < 2:
            results.append({'WorkPackageID': wp_id, 'ms_delay_trend': 'insufficient_data',
                           'ms_delay_trend_delta': None})
            continue

        latest = period_stats.iloc[-1]['delayed_prop']
        prior = period_stats.iloc[-2]['delayed_prop']
        delta = round(prior - latest, 4)  # positive = improving (fewer delays)
        results.append({
            'WorkPackageID': wp_id,
            'ms_delay_trend': _trend_label(delta, 0.05),
            'ms_delay_trend_delta': delta,
        })

    return pd.DataFrame(results) if results else pd.DataFrame(
        columns=['WorkPackageID', 'ms_delay_trend', 'ms_delay_trend_delta'])


def compute_backlog_trend(so):
    """Service Order Backlog trend: bin by RequestedDate into monthly buckets.
    Compare BacklogRatio latest vs prior month. ±10pp threshold.
    """
    so = so.copy()
    so = so.dropna(subset=['WorkPackageID'])
    so['IsOpen'] = ~so['Status'].isin(['Completed', 'Cancelled'])
    date_col = 'RequestedDate' if 'RequestedDate' in so.columns else 'CreatedDate'
    so['Period'] = pd.to_datetime(so[date_col], errors='coerce').dt.to_period('M')
    so = so.dropna(subset=['Period'])

    results = []
    for wp_id, group in so.groupby('WorkPackageID'):
        period_stats = group.groupby('Period').agg(
            total=('ServiceOrderID', 'count'),
            open_count=('IsOpen', 'sum'),
        )
        period_stats['backlog_ratio'] = period_stats['open_count'] / period_stats['total']
        period_stats = period_stats.sort_index()

        if len(period_stats) < 2:
            results.append({'WorkPackageID': wp_id, 'backlog_trend': 'insufficient_data',
                           'backlog_trend_delta': None})
            continue

        latest = period_stats.iloc[-1]['backlog_ratio']
        prior = period_stats.iloc[-2]['backlog_ratio']
        delta = round(prior - latest, 4)  # positive = improving (lower backlog)
        results.append({
            'WorkPackageID': wp_id,
            'backlog_trend': _trend_label(delta, 0.10),
            'backlog_trend_delta': delta,
        })

    return pd.DataFrame(results) if results else pd.DataFrame(
        columns=['WorkPackageID', 'backlog_trend', 'backlog_trend_delta'])


def compute_cashflow_trend(cashflow):
    """Cashflow Deviation trend: group by Stage, compute deviation per stage.
    Compare latest stage vs prior stage. Narrowing = Improving, widening = Declining.
    """
    cf = cashflow.copy()
    cf = cf.dropna(subset=['WorkPackageID'])

    results = []
    for wp_id, group in cf.groupby('WorkPackageID'):
        stages = sorted(group['Stage'].dropna().unique())
        if len(stages) < 2:
            results.append({'WorkPackageID': wp_id, 'cashflow_trend': 'insufficient_data',
                           'cashflow_trend_delta': None})
            continue

        stage_devs = []
        for stage in stages:
            sg = group[group['Stage'] == stage]
            planned = sg[sg['CashflowType'] == 'Planned']['Amount'].sum()
            actual = sg[sg['CashflowType'] == 'Actual']['Amount'].sum()
            if planned > 0:
                dev = abs(actual - planned) / planned
            else:
                dev = 0
            stage_devs.append(dev)

        # Compare last two stages
        latest_dev = stage_devs[-1]
        prior_dev = stage_devs[-2]
        delta = round(prior_dev - latest_dev, 4)  # positive = narrowing = improving
        results.append({
            'WorkPackageID': wp_id,
            'cashflow_trend': _trend_label(delta, 0.05),
            'cashflow_trend_delta': delta,
        })

    return pd.DataFrame(results) if results else pd.DataFrame(
        columns=['WorkPackageID', 'cashflow_trend', 'cashflow_trend_delta'])


def compute_supplier_score_trend(scores):
    """Supplier Score trend: last 3 evaluations per supplier (count-based).
    Compare earliest vs latest. >+5pp = Improving, ±5pp = Stable, <-5pp = Declining.
    Returns per-WP aggregate (avg across suppliers linked to WP via ContractID).
    """
    sc = scores.copy()
    sc['ScorePercentage'] = pd.to_numeric(sc['ScorePercentage'], errors='coerce')
    sc = sc.dropna(subset=['ScorePercentage', 'SupplierID'])
    sc = sc.sort_values('ScoreDate')

    # Per-supplier trend
    supplier_trends = []
    for sup_id, group in sc.groupby('SupplierID'):
        if len(group) < 3:
            supplier_trends.append({'SupplierID': sup_id, 'sup_trend_delta': None})
            continue
        last3 = group.tail(3)
        p1 = last3.iloc[0]['ScorePercentage']
        p3 = last3.iloc[-1]['ScorePercentage']
        delta = round(p3 - p1, 4)
        supplier_trends.append({'SupplierID': sup_id, 'sup_trend_delta': delta})

    if not supplier_trends:
        return pd.DataFrame(columns=['WorkPackageID', 'supplier_trend', 'supplier_trend_delta'])

    sup_df = pd.DataFrame(supplier_trends)

    # Map suppliers to WPs via ContractID in scores
    if 'ContractID' not in sc.columns:
        return pd.DataFrame(columns=['WorkPackageID', 'supplier_trend', 'supplier_trend_delta'])

    # Get WP mapping from scores (via ContractID if available)
    # Since scores may not have WorkPackageID directly, we aggregate at supplier level
    # and return supplier-level trends that export_state can use
    sup_df['supplier_trend'] = sup_df['sup_trend_delta'].apply(
        lambda d: 'insufficient_data' if pd.isna(d) else _trend_label(d, 5.0))

    return sup_df


def compute_all_trends(data):
    """Compute all 6 trend signals. Returns dict of DataFrames to merge onto wp_master."""
    cost_perf = data['cost_perf']
    ms = data['ms']
    so = data['so']
    cashflow = data['cashflow']
    scores = data['scores']

    cpi_trend = compute_cpi_trend(cost_perf)
    spi_trend = compute_spi_trend(cost_perf)
    ms_trend = compute_milestone_delay_trend(ms)
    backlog_trend = compute_backlog_trend(so)
    cf_trend = compute_cashflow_trend(cashflow)
    supplier_trend = compute_supplier_score_trend(scores)

    print(f"  Trends computed: CPI={len(cpi_trend)}, SPI={len(spi_trend)}, "
          f"MS={len(ms_trend)}, Backlog={len(backlog_trend)}, "
          f"Cashflow={len(cf_trend)}, Supplier={len(supplier_trend)}")

    return {
        'cpi_trend': cpi_trend,
        'spi_trend': spi_trend,
        'ms_delay_trend': ms_trend,
        'backlog_trend': backlog_trend,
        'cashflow_trend': cf_trend,
        'supplier_trend': supplier_trend,
    }
