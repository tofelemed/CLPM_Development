import 'dotenv/config';
import { Pool } from 'pg';
import { InfluxDBClient } from './src/influxClient.js';
import pino from 'pino';

const log = pino({ name: 'kpi-trigger', level: 'info' });

// Import the KPI calculation logic
async function calculateKPIs(data, config, loop) {
  const validData = data.filter(d =>
    d.pv !== null && d.op !== null && d.sp !== null &&
    d.quality_code === 192
  );

  if (validData.length === 0) {
    return null;
  }

  validData.sort((a, b) => new Date(a.ts) - new Date(b.ts));

  const pvValues = validData.map(d => d.pv);
  const opValues = validData.map(d => d.op);
  const spValues = validData.map(d => d.sp);
  const modes = validData.map(d => d.mode);
  const valveValues = validData.filter(d => d.valve_position !== null).map(d => d.valve_position);

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

  // Valve Travel
  let valveTravel = null;
  if (valveValues.length > 1) {
    valveTravel = 0;
    for (let i = 1; i < valveValues.length; i++) {
      valveTravel += Math.abs(valveValues[i] - valveValues[i - 1]);
    }
  }

  // Valve Reversals
  let valveReversals = 0;
  if (opValues.length > 2) {
    for (let i = 2; i < opValues.length; i++) {
      const prevDiff = opValues[i - 1] - opValues[i - 2];
      const currDiff = opValues[i] - opValues[i - 1];
      if ((prevDiff > 0 && currDiff < 0) || (prevDiff < 0 && currDiff > 0)) {
        valveReversals++;
      }
    }
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

  // Stiction
  let stictionSeverity = 0;
  if (opValues.length > 1 && pvValues.length > 1) {
    const opMean = opValues.reduce((a, b) => a + b, 0) / opValues.length;
    const maxLag = Math.min(10, Math.floor(opValues.length / 2));
    let maxCorrelation = 0;

    for (let lag = 1; lag <= maxLag; lag++) {
      let numerator = 0;
      let opDenom = 0;
      let pvDenom = 0;
      let count = 0;

      for (let i = lag; i < opValues.length && i < pvValues.length; i++) {
        const opDiff = opValues[i] - opMean;
        const pvDiff = pvValues[i - lag] - pvMean;
        numerator += opDiff * pvDiff;
        opDenom += opDiff * opDiff;
        pvDenom += pvDiff * pvDiff;
        count++;
      }

      if (count > 0 && opDenom > 0 && pvDenom > 0) {
        const correlation = Math.abs(numerator / Math.sqrt(opDenom * pvDenom));
        maxCorrelation = Math.max(maxCorrelation, correlation);
      }
    }

    stictionSeverity = maxCorrelation;
  }

  // Additional metrics
  const opChanges = [];
  for (let i = 1; i < opValues.length; i++) {
    const change = Math.abs(opValues[i] - opValues[i - 1]);
    if (change > 0) opChanges.push(change);
  }
  const deadband = opChanges.length > 0 ? Math.min(...opChanges) : null;

  const errors = validData.map(d => d.sp - d.pv);
  const peakError = errors.length > 0 ? Math.max(...errors.map(Math.abs)) : null;
  const integralError = errors.reduce((sum, e) => sum + Math.abs(e), 0) / errors.length;

  const errorDerivatives = [];
  for (let i = 1; i < errors.length; i++) {
    errorDerivatives.push(Math.abs(errors[i] - errors[i - 1]));
  }
  const derivativeError = errorDerivatives.length > 0
    ? errorDerivatives.reduce((a, b) => a + b, 0) / errorDerivatives.length
    : null;

  const controlError = Math.sqrt(errorVariance);

  let noiseLevel = 0;
  if (pvValues.length > 2) {
    const secondDerivatives = [];
    for (let i = 2; i < pvValues.length; i++) {
      const secondDeriv = Math.abs((pvValues[i] - 2 * pvValues[i - 1] + pvValues[i - 2]));
      secondDerivatives.push(secondDeriv);
    }
    noiseLevel = secondDerivatives.length > 0
      ? secondDerivatives.reduce((a, b) => a + b, 0) / secondDerivatives.length
      : 0;
  }

  let setpointChanges = 0;
  const spChangeThreshold = 0.5;
  for (let i = 1; i < spValues.length; i++) {
    if (Math.abs(spValues[i] - spValues[i - 1]) > spChangeThreshold) {
      setpointChanges++;
    }
  }

  let modeChanges = 0;
  for (let i = 1; i < modes.length; i++) {
    if (modes[i] !== modes[i - 1]) {
      modeChanges++;
    }
  }

  const roundToDecimals = (value, decimals) => {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  };

  return {
    service_factor: roundToDecimals(serviceFactor, 6),
    effective_sf: roundToDecimals(effectiveServiceFactor, 6),
    sat_percent: roundToDecimals(saturationPercentage, 6),
    saturation: roundToDecimals(saturationPercentage, 6),
    output_travel: roundToDecimals(outputTravel, 3),
    valve_travel: valveTravel !== null ? roundToDecimals(valveTravel, 6) : null,
    valve_reversals: valveReversals,
    pi: roundToDecimals(pi, 6),
    rpi: roundToDecimals(rpi, 6),
    osc_index: roundToDecimals(oscillationIndex, 6),
    stiction: roundToDecimals(stictionSeverity, 6),
    deadband: deadband !== null ? roundToDecimals(deadband, 6) : null,
    peak_error: peakError !== null ? roundToDecimals(peakError, 3) : null,
    integral_error: roundToDecimals(integralError, 3),
    derivative_error: derivativeError !== null ? roundToDecimals(derivativeError, 3) : null,
    control_error: roundToDecimals(controlError, 3),
    noise_level: roundToDecimals(noiseLevel, 6),
    setpoint_changes: setpointChanges,
    mode_changes: modeChanges,
    settling_time: null,
    overshoot: null,
    rise_time: null,
    process_gain: null,
    time_constant: null,
    dead_time: null
  };
}

async function triggerKPI() {
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
    log.info('Triggering KPI calculation for TIC208030');

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (60 * 60 * 1000));

    const data = await influxClient.queryData(
      'TIC208030',
      startTime.toISOString(),
      endTime.toISOString()
    );

    log.info({ dataPoints: data.length }, 'Retrieved data');

    if (data.length === 0) {
      log.warn('No data available');
      return;
    }

    const kpis = await calculateKPIs(data, {}, { loop_id: 'TIC208030' });

    log.info({ kpis }, 'Calculated KPIs');

    // Insert into database
    const query = `
      INSERT INTO kpi_results (
        loop_id, timestamp, service_factor, effective_sf,
        sat_percent, saturation, output_travel, valve_travel, valve_reversals,
        pi, rpi, osc_index, stiction, deadband,
        settling_time, overshoot, rise_time,
        peak_error, integral_error, derivative_error, control_error,
        noise_level, process_gain, time_constant, dead_time,
        setpoint_changes, mode_changes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      RETURNING id, timestamp
    `;

    const values = [
      'TIC208030',
      endTime,
      kpis.service_factor,
      kpis.effective_sf,
      kpis.sat_percent,
      kpis.saturation,
      kpis.output_travel,
      kpis.valve_travel,
      kpis.valve_reversals,
      kpis.pi,
      kpis.rpi,
      kpis.osc_index,
      kpis.stiction,
      kpis.deadband,
      kpis.settling_time,
      kpis.overshoot,
      kpis.rise_time,
      kpis.peak_error,
      kpis.integral_error,
      kpis.derivative_error,
      kpis.control_error,
      kpis.noise_level,
      kpis.process_gain,
      kpis.time_constant,
      kpis.dead_time,
      kpis.setpoint_changes,
      kpis.mode_changes
    ];

    const result = await db.query(query, values);

    log.info({ inserted: result.rows[0] }, '✅ KPI result inserted into database');

    // Verify
    const verify = await db.query(
      'SELECT * FROM kpi_results WHERE id = $1',
      [result.rows[0].id]
    );

    log.info({ record: verify.rows[0] }, '✅ Verified database record');

  } catch (error) {
    log.error({ error: error.message, stack: error.stack }, 'Failed to trigger KPI');
  } finally {
    await db.end();
    await influxClient.close();
  }
}

triggerKPI();
