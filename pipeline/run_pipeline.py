"""
Project Spider — Main Pipeline Runner
Runs the full data pipeline: Load -> Compute Risks -> Compute Trends -> Export state.json
Updated for 6-dimension EY Risk Framework with weighted CRI.
"""
import sys
import os

# Fix Windows encoding
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Add pipeline dir to path
sys.path.insert(0, os.path.dirname(__file__))

from load_data import load_all
from compute_risks import compute_all_risks
from compute_trends import compute_all_trends
from export_state import export_state_json


def main():
    print("=" * 60)
    print("  PROJECT SPIDER - Data Pipeline (6-Dimension Framework)")
    print("=" * 60)

    # Step 1: Load data
    print("\n[1/4] Loading CSV data...")
    data = load_all()

    # Step 2: Compute all risk indicators (9 sub-components → 6 dimensions + CRI)
    print("\n[2/4] Computing risk indicators (10 sub-components, 6 dimensions, weighted CRI)...")
    wp_master, dq_modifier = compute_all_risks(data)

    # Step 3: Compute trend/velocity signals
    print("\n[3/4] Computing trend signals (6 metrics)...")
    trends = compute_all_trends(data)

    # Merge WP-level trends onto wp_master
    for trend_key in ['cpi_trend', 'spi_trend', 'ms_delay_trend', 'backlog_trend', 'cashflow_trend']:
        trend_df = trends[trend_key]
        if len(trend_df) > 0 and 'WorkPackageID' in trend_df.columns:
            wp_master = wp_master.merge(trend_df, on='WorkPackageID', how='left')

    # Step 4: Export state.json
    print("\n[4/4] Exporting state.json...")
    pipeline_dir = os.path.dirname(__file__)
    project_dir = os.path.dirname(pipeline_dir)
    
    # Primary output: frontend/public/data/state.json (where Next.js reads from)
    output_path = os.path.join(project_dir, 'frontend', 'public', 'data', 'state.json')
    state = export_state_json(wp_master, data, output_path, dq_modifier, trends)
    
    # Also copy to project-spider/public/data/ for backwards compatibility
    backup_path = os.path.join(project_dir, 'public', 'data', 'state.json')
    os.makedirs(os.path.dirname(backup_path), exist_ok=True)
    import shutil
    shutil.copy2(output_path, backup_path)

    print("\n" + "=" * 60)
    print("  DONE - Pipeline complete!")
    print("=" * 60)

    return state


if __name__ == '__main__':
    main()
