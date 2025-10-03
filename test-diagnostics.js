const { InfluxDB } = require('@influxdata/influxdb-client');
const axios = require('axios');

// InfluxDB configuration
const INFLUX_URL = process.env.INFLUX_URL || 'http://localhost:8086';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || 'my-super-secret-auth-token';
const INFLUX_ORG = process.env.INFLUX_ORG || 'clpm';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'control_loops';

// Diagnostics service URL
const DIAG_URL = 'http://localhost:8050';

// Test loop configuration
const TEST_LOOP = {
  loop_id: 'TIC208030',
  name: 'TIC208030 Temperature Control Loop'
};

async function getInfluxData(loopId, durationMinutes = 15) {
  const influxDB = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
  const queryApi = influxDB.getQueryApi(INFLUX_ORG);

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - durationMinutes * 60 * 1000);

  const fluxQuery = `
    from(bucket: "${INFLUX_BUCKET}")
      |> range(start: ${startTime.toISOString()}, stop: ${endTime.toISOString()})
      |> filter(fn: (r) => r.Tag == "${loopId}")
      |> filter(fn: (r) => r._field == "pv" or r._field == "op" or r._field == "sp" or r._field == "Mode")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> filter(fn: (r) => exists r.pv and exists r.op)
  `;

  console.log(`\n📊 Fetching data from InfluxDB for ${loopId}...`);
  console.log(`⏰ Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);

  const data = [];

  return new Promise((resolve, reject) => {
    queryApi.queryRows(fluxQuery, {
      next(row, tableMeta) {
        const o = tableMeta.toObject(row);
        data.push({
          time: new Date(o._time).getTime() / 1000, // Unix epoch seconds
          pv: parseFloat(o.pv),
          op: parseFloat(o.op),
          sp: o.sp ? parseFloat(o.sp) : null,
          mode: o.Mode
        });
      },
      error(error) {
        console.error('❌ InfluxDB query error:', error);
        reject(error);
      },
      complete() {
        console.log(`✅ Retrieved ${data.length} data points from InfluxDB`);
        resolve(data);
      },
    });
  });
}

async function runDiagnostics(loopId, data) {
  console.log(`\n🔬 Running diagnostics for ${loopId}...`);

  // Prepare data in the format expected by diagnostics service
  const series = {
    ts: data.map(d => d.time),
    pv: data.map(d => d.pv),
    op: data.map(d => d.op),
    sp: data.filter(d => d.sp !== null).map(d => d.sp)
  };

  // Calculate sample rate
  const sampleRateHz = data.length > 1
    ? 1 / ((data[data.length - 1].time - data[0].time) / data.length)
    : null;

  const payload = {
    loop_id: loopId,
    series: series,
    sample_rate_hz: sampleRateHz
  };

  console.log(`📈 Data summary:`);
  console.log(`   - Total points: ${data.length}`);
  console.log(`   - PV range: ${Math.min(...series.pv).toFixed(2)} to ${Math.max(...series.pv).toFixed(2)}`);
  console.log(`   - OP range: ${Math.min(...series.op).toFixed(2)} to ${Math.max(...series.op).toFixed(2)}`);
  console.log(`   - Sample rate: ${sampleRateHz ? sampleRateHz.toFixed(4) : 'N/A'} Hz`);

  try {
    const response = await axios.post(`${DIAG_URL}/diagnostics/run`, payload);
    const result = response.data;

    console.log(`\n✨ Diagnostic Results:`);
    console.log(`   - Loop ID: ${result.loop_id}`);
    console.log(`   - Classification: ${result.classification}`);
    console.log(`   - Stiction (cross-correlation): ${(result.stiction_xcorr * 100).toFixed(2)}%`);
    console.log(`   - Oscillation Index: ${result.osc_index.toFixed(4)}`);
    console.log(`   - Oscillation Period: ${result.osc_period_s ? result.osc_period_s.toFixed(2) + 's' : 'None detected'}`);

    // Interpret results
    console.log(`\n🔍 Interpretation:`);
    if (result.classification === 'stiction') {
      console.log(`   ⚠️  STICTION DETECTED - Valve may be sticking`);
    } else if (result.classification === 'oscillating') {
      console.log(`   ⚠️  OSCILLATING - Loop is oscillating, may need tuning`);
    } else if (result.classification === 'tuning') {
      console.log(`   ⚠️  TUNING ISSUE - Controller parameters may need adjustment`);
    } else if (result.classification === 'deadband') {
      console.log(`   ⚠️  DEADBAND - Significant deadband detected`);
    } else {
      console.log(`   ✅ NORMAL - Loop performance is acceptable`);
    }

    if (result.stiction_xcorr > 0.35) {
      console.log(`   - High cross-correlation suggests valve stiction`);
    }
    if (result.osc_index > 0.4) {
      console.log(`   - High oscillation index indicates sustained oscillations`);
    }

    return result;
  } catch (error) {
    console.error('❌ Error calling diagnostics service:', error.response?.data || error.message);
    throw error;
  }
}

async function testDiagnostics() {
  console.log('🚀 Starting Diagnostics Service Test\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Get data from InfluxDB
    const influxData = await getInfluxData(TEST_LOOP.loop_id, 15);

    if (influxData.length === 0) {
      console.log('❌ No data found in InfluxDB for the specified loop');
      return;
    }

    // Test 2: Run diagnostics
    const diagnosticResult = await runDiagnostics(TEST_LOOP.loop_id, influxData);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnostics test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testDiagnostics();
