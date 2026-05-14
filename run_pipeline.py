"""
Project Spider — Main Pipeline Runner
Runs the full data pipeline: Load -> Compute Risks -> Export state.json
"""
import sys
import os

# Fix Windows encoding
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Add pipeline dir to path
sys.path.insert(0, os.path.dirname(__file__))

from load_data import load_all
from compute_risks import compute_all_risks
from export_state import export_state_json


def main():
    print("=" * 60)
    print("  PROJECT SPIDER - Data Pipeline")
    print("=" * 60)

    # Step 1: Load data
    print("\n[1/3] Loading CSV data...")
    data = load_all()

    # Step 2: Compute all risk indicators
    print("\n[2/3] Computing risk indicators (9 sub-components, 3 pillars)...")
    wp_master = compute_all_risks(data)

    # Step 3: Export state.json
    print("\n[3/3] Exporting state.json...")
    output_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        'public', 'data', 'state.json'
    )
    state = export_state_json(wp_master, data, output_path)

    print("\n" + "=" * 60)
    print("  DONE - Pipeline complete!")
    print("=" * 60)

    return state


if __name__ == '__main__':
    main()
