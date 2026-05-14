"""
Project Spider — Data Loader
Loads all CSVs, parses dates, validates foreign keys.
"""
import pandas as pd
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
def load_all():
    """Load and parse all CSV files. Returns dict of DataFrames."""
    
    wp = pd.read_csv(os.path.join(DATA_DIR, 'WorkPackages.csv'))
    ms = pd.read_csv(os.path.join(DATA_DIR, 'Milestones.csv'))
    so = pd.read_csv(os.path.join(DATA_DIR, 'ServiceOrders.csv'))
    contracts = pd.read_csv(os.path.join(DATA_DIR, 'ContractsSuppliers.csv'))
    scores = pd.read_csv(os.path.join(DATA_DIR, 'SupplierScores.csv'))
    cost_perf = pd.read_csv(os.path.join(DATA_DIR, 'Stage_CostPerformance.csv'))
    cashflow = pd.read_csv(os.path.join(DATA_DIR, 'Stage_Cashflow.csv'))
    org = pd.read_csv(os.path.join(DATA_DIR, 'OrgDim.csv'))

    # Parse dates
    date_cols_wp = ['PlannedStartDate','PlannedEndDate','ActualStartDate','ActualEndDate','CreatedDate','LastUpdated']
    for c in date_cols_wp:
        if c in wp.columns:
            wp[c] = pd.to_datetime(wp[c], errors='coerce')

    date_cols_ms = ['PlannedDate','ForecastDate','ActualDate','CreatedDate','LastUpdated']
    for c in date_cols_ms:
        if c in ms.columns:
            ms[c] = pd.to_datetime(ms[c], errors='coerce')

    date_cols_so = ['RequestedDate','StartDate','CompletedDate','CreatedDate','LastUpdated']
    for c in date_cols_so:
        if c in so.columns:
            so[c] = pd.to_datetime(so[c], errors='coerce')

    date_cols_ct = ['StartDate','EndDate','CreatedDate','LastUpdated']
    for c in date_cols_ct:
        if c in contracts.columns:
            contracts[c] = pd.to_datetime(contracts[c], errors='coerce')

    if 'ScoreDate' in scores.columns:
        scores['ScoreDate'] = pd.to_datetime(scores['ScoreDate'], errors='coerce')

    if 'RecordDate' in cost_perf.columns:
        cost_perf['RecordDate'] = pd.to_datetime(cost_perf['RecordDate'], errors='coerce')

    if 'RecordDate' in cashflow.columns:
        cashflow['RecordDate'] = pd.to_datetime(cashflow['RecordDate'], errors='coerce')

    print(f"Loaded: WP={len(wp)}, MS={len(ms)}, SO={len(so)}, Contracts={len(contracts)}, "
          f"Scores={len(scores)}, CostPerf={len(cost_perf)}, Cashflow={len(cashflow)}, Org={len(org)}")

    return {
        'wp': wp, 'ms': ms, 'so': so, 'contracts': contracts,
        'scores': scores, 'cost_perf': cost_perf, 'cashflow': cashflow, 'org': org
    }


if __name__ == '__main__':
    data = load_all()
    for name, df in data.items():
        print(f"\n--- {name} ---")
        print(f"  Shape: {df.shape}")
        print(f"  Columns: {list(df.columns)}")
        print(f"  Nulls:\n{df.isnull().sum()[df.isnull().sum() > 0]}")
