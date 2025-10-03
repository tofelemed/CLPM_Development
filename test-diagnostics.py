#!/usr/bin/env python3
"""
Test script for diagnostics service
Fetches data from InfluxDB and runs diagnostics
"""

import requests
import json
from datetime import datetime, timedelta
from influxdb_client import InfluxDBClient

# Configuration
INFLUX_URL = "http://localhost:8086"
INFLUX_TOKEN = "o6cjAfkS_jFCvEePxDyz33zMQaJgbbSz_oqkSPzMTbROImhLlwDHwh8la4VMkMyNJsHWrVYs_JEHpWZGtFeaDw=="
INFLUX_ORG = "clpm"
INFLUX_BUCKET = "clpm_data"
DIAG_URL = "http://localhost:8050"

# Test loop
TEST_LOOP = "TIC208030"

def get_influx_data(loop_id, duration_minutes=15):
    """Fetch data from InfluxDB for the specified loop"""
    print(f"\n[DATA] Fetching data from InfluxDB for {loop_id}...")

    client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
    query_api = client.query_api()

    end_time = datetime.utcnow()
    start_time = end_time - timedelta(minutes=duration_minutes)

    query = f'''
    from(bucket: "{INFLUX_BUCKET}")
      |> range(start: {start_time.isoformat()}Z, stop: {end_time.isoformat()}Z)
      |> filter(fn: (r) => r._measurement == "control_loops")
      |> filter(fn: (r) => r.loop_id == "{loop_id}")
      |> filter(fn: (r) => r._field == "pv" or r._field == "op" or r._field == "sp")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> filter(fn: (r) => exists r.pv and exists r.op)
      |> sort(columns: ["_time"])
    '''

    print(f"[TIME] Range: {start_time.isoformat()}Z to {end_time.isoformat()}Z")

    result = query_api.query(query)

    data = []
    for table in result:
        for record in table.records:
            data.append({
                'time': record.get_time().timestamp(),
                'pv': float(record.values.get('pv', 0)),
                'op': float(record.values.get('op', 0)),
                'sp': float(record.values.get('sp', 0)) if record.values.get('sp') else None
            })

    client.close()
    print(f"[OK] Retrieved {len(data)} data points from InfluxDB")
    return data

def run_diagnostics(loop_id, data):
    """Run diagnostics using the diagnostics service"""
    print(f"\n[DIAG] Running diagnostics for {loop_id}...")

    # Prepare series data
    series = {
        'ts': [d['time'] for d in data],
        'pv': [d['pv'] for d in data],
        'op': [d['op'] for d in data],
        'sp': [d['sp'] for d in data if d['sp'] is not None]
    }

    # Calculate sample rate
    sample_rate_hz = None
    if len(data) > 1:
        total_time = data[-1]['time'] - data[0]['time']
        sample_rate_hz = len(data) / total_time if total_time > 0 else None

    payload = {
        'loop_id': loop_id,
        'series': series,
        'sample_rate_hz': sample_rate_hz
    }

    print(f"[SUMMARY] Data summary:")
    print(f"   - Total points: {len(data)}")
    print(f"   - PV range: {min(series['pv']):.2f} to {max(series['pv']):.2f}")
    print(f"   - OP range: {min(series['op']):.2f} to {max(series['op']):.2f}")
    if sample_rate_hz:
        print(f"   - Sample rate: {sample_rate_hz:.4f} Hz")

    # Call diagnostics service
    response = requests.post(f"{DIAG_URL}/diagnostics/run", json=payload)
    response.raise_for_status()

    result = response.json()

    print(f"\n[RESULTS] Diagnostic Results:")
    print(f"   - Loop ID: {result['loop_id']}")
    print(f"   - Classification: {result['classification']}")
    print(f"   - Stiction (cross-correlation): {result['stiction_xcorr'] * 100:.2f}%")
    print(f"   - Oscillation Index: {result['osc_index']:.4f}")
    print(f"   - Oscillation Period: {result['osc_period_s']:.2f}s" if result['osc_period_s'] else "   - Oscillation Period: None detected")

    # Interpretation
    print(f"\n[INTERPRET] Interpretation:")
    if result['classification'] == 'stiction':
        print("   [WARNING] STICTION DETECTED - Valve may be sticking")
    elif result['classification'] == 'oscillating':
        print("   [WARNING] OSCILLATING - Loop is oscillating, may need tuning")
    elif result['classification'] == 'tuning':
        print("   [WARNING] TUNING ISSUE - Controller parameters may need adjustment")
    elif result['classification'] == 'deadband':
        print("   [WARNING] DEADBAND - Significant deadband detected")
    else:
        print("   [OK] NORMAL - Loop performance is acceptable")

    if result['stiction_xcorr'] > 0.35:
        print("   - High cross-correlation suggests valve stiction")
    if result['osc_index'] > 0.4:
        print("   - High oscillation index indicates sustained oscillations")

    return result

def main():
    print("[START] Starting Diagnostics Service Test\n")
    print("=" * 60)

    try:
        # Fetch data from InfluxDB
        influx_data = get_influx_data(TEST_LOOP, duration_minutes=15)

        if not influx_data:
            print("[ERROR] No data found in InfluxDB for the specified loop")
            return

        # Run diagnostics
        diagnostic_result = run_diagnostics(TEST_LOOP, influx_data)

        print("\n" + "=" * 60)
        print("[SUCCESS] Diagnostics test completed successfully!")
        print(f"\n[DB] Result that would be saved to database:")
        print(json.dumps(diagnostic_result, indent=2))

    except Exception as e:
        print(f"\n[ERROR] Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    main()
