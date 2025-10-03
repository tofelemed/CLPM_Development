import 'dotenv/config';
import { Pool } from 'pg';
import { InfluxDBClient } from './src/influxClient.js';
import pino from 'pino';

const log = pino({ name: 'kpi-test', level: 'debug' });

// Test KPI calculation for a specific loop
async function testKPICalculation() {
  const db = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'clpm',
    user: process.env.DB_USER || 'clpm',
    password: process.env.DB_PASSWORD || 'clpm_pwd',
  });

  const influxClient = new InfluxDBClient({
    url: process.env.INFLUXDB_URL || 'http://localhost:8086',
    token: process.env.INFLUXDB_TOKEN || 'o6cjAfkS_jFCvEePxDyz33zMQaJgbbSz_oqkSPzMTbROImhLlwDHwh8la4VMkMyNJsHWrVYs_JEHpWZGtFeaDw==',
    org: process.env.INFLUXDB_ORG || 'clpm',
    bucket: process.env.INFLUXDB_BUCKET || 'clpm_data',
    measurement: process.env.INFLUXDB_MEASUREMENT || 'control_loops'
  });

  try {
    log.info('Starting KPI test for loop TIC208030');

    // Get data for last 1 hour
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (60 * 60 * 1000)); // 1 hour ago

    log.info({ startTime: startTime.toISOString(), endTime: endTime.toISOString() }, 'Query window');

    const data = await influxClient.queryData(
      'TIC208030',
      startTime.toISOString(),
      endTime.toISOString()
    );

    log.info({ dataPoints: data.length }, 'Retrieved data from InfluxDB');

    if (data.length === 0) {
      log.warn('No data retrieved!');
      return;
    }

    // Show sample of data
    log.info({ sample: data.slice(0, 5) }, 'Sample data');

    // Filter valid data
    const validData = data.filter(d =>
      d.pv !== null && d.op !== null && d.sp !== null &&
      d.quality_code === 192
    );

    log.info({ validDataPoints: validData.length }, 'Valid data after filtering');

    if (validData.length === 0) {
      log.warn('No valid data!');
      return;
    }

    // Sort by timestamp
    validData.sort((a, b) => new Date(a.ts) - new Date(b.ts));

    // Calculate basic statistics
    const pvValues = validData.map(d => d.pv);
    const opValues = validData.map(d => d.op);
    const spValues = validData.map(d => d.sp);
    const modes = validData.map(d => d.mode);

    log.info({
      pvRange: `${Math.min(...pvValues).toFixed(2)} - ${Math.max(...pvValues).toFixed(2)}`,
      opRange: `${Math.min(...opValues).toFixed(2)} - ${Math.max(...opValues).toFixed(2)}`,
      spRange: `${Math.min(...spValues).toFixed(2)} - ${Math.max(...spValues).toFixed(2)}`,
      modeDistribution: {
        AUT: modes.filter(m => m && m.toString().toUpperCase().includes('AUT')).length,
        CAS: modes.filter(m => m && m.toString().toUpperCase().includes('CAS')).length,
        MAN: modes.filter(m => m && m.toString().toUpperCase().includes('MAN')).length,
        total: modes.length
      }
    }, 'Data statistics');

    // Service Factor
    const autoModeCount = modes.filter(m =>
      m && (m.toString().toUpperCase().includes('AUT') || m.toString().toUpperCase().includes('CAS'))
    ).length;
    const serviceFactor = validData.length > 0 ? autoModeCount / validData.length : 0;

    // Saturation
    const saturationThreshold = 5;
    const saturatedCount = opValues.filter(op =>
      op <= saturationThreshold || op >= (100 - saturationThreshold)
    ).length;
    const saturationPercentage = validData.length > 0 ? saturatedCount / validData.length : 0;

    // Effective Service Factor
    const effectiveServiceFactor = serviceFactor * (1 - saturationPercentage);

    // Output Travel
    let outputTravel = 0;
    for (let i = 1; i < opValues.length; i++) {
      outputTravel += Math.abs(opValues[i] - opValues[i - 1]);
    }

    // Performance Index
    const pvMean = pvValues.reduce((a, b) => a + b, 0) / pvValues.length;
    const pvVariance = pvValues.reduce((sum, val) => sum + Math.pow(val - pvMean, 2), 0) / pvValues.length;
    const errorVariance = validData.reduce((sum, d) => sum + Math.pow(d.pv - d.sp, 2), 0) / validData.length;
    const pi = pvVariance > 0 ? Math.max(0, Math.min(1, 1 - (errorVariance / pvVariance))) : 0;

    // RPI
    const rpi = pi * serviceFactor;

    // Oscillation Index
    let oscillationIndex = 0;
    if (pvValues.length > 1) {
      let numerator = 0;
      let denominator = 0;

      for (let i = 1; i < pvValues.length; i++) {
        const diff1 = pvValues[i] - pvMean;
        const diff2 = pvValues[i - 1] - pvMean;
        numerator += diff1 * diff2;
        denominator += diff1 * diff1;
      }

      oscillationIndex = denominator > 0 ? Math.abs(numerator / denominator) : 0;
    }

    const kpis = {
      service_factor: (serviceFactor * 100).toFixed(2) + '%',
      effective_sf: (effectiveServiceFactor * 100).toFixed(2) + '%',
      sat_percent: (saturationPercentage * 100).toFixed(2) + '%',
      output_travel: outputTravel.toFixed(2),
      pi: pi.toFixed(6),
      rpi: rpi.toFixed(6),
      osc_index: oscillationIndex.toFixed(6)
    };

    log.info({ kpis }, '📊 CALCULATED KPIs');

    // Check if KPIs exist in database
    const dbCheck = await db.query(
      'SELECT * FROM kpi_results WHERE loop_id = $1 ORDER BY timestamp DESC LIMIT 5',
      ['TIC208030']
    );

    log.info({ count: dbCheck.rows.length }, 'Existing KPI results in database');
    if (dbCheck.rows.length > 0) {
      log.info({ latest: dbCheck.rows[0] }, 'Latest KPI result from database');
    }

  } catch (error) {
    log.error({ error: error.message, stack: error.stack }, 'Test failed');
  } finally {
    await db.end();
    await influxClient.close();
  }
}

testKPICalculation();
