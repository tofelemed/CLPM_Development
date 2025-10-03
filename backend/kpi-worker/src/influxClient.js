import { InfluxDB } from '@influxdata/influxdb-client';
import pino from 'pino';

const log = pino({ name: 'kpi-influxdb-client' });

export class InfluxDBClient {
  constructor(config) {
    this.config = {
      url: config.url || process.env.INFLUXDB_URL || 'http://influxdb:8086/',
      token: config.token || process.env.INFLUXDB_TOKEN || 'o6cjAfkS_jFCvEePxDyz33zMQaJgbbSz_oqkSPzMTbROImhLlwDHwh8la4VMkMyNJsHWrVYs_JEHpWZGtFeaDw==',
      org: config.org || process.env.INFLUXDB_ORG || 'clpm',
      bucket: config.bucket || process.env.INFLUXDB_BUCKET || 'clpm_data',
      measurement: config.measurement || process.env.INFLUXDB_MEASUREMENT || 'control_loops',
      ...config
    };

    this.client = new InfluxDB({ 
      url: this.config.url, 
      token: this.config.token 
    });
    
    this.queryApi = this.client.getQueryApi(this.config.org);
    
    log.info({ 
      url: this.config.url, 
      org: this.config.org, 
      bucket: this.config.bucket,
      measurement: this.config.measurement 
    }, 'KPI InfluxDB client initialized');
  }

  async testConnection() {
    try {
      const query = `from(bucket: "${this.config.bucket}")
        |> range(start: -1m)
        |> limit(n: 1)`;
      
      await this.queryApi.queryRaw(query);
      log.info('KPI InfluxDB connection test successful');
      return true;
    } catch (error) {
      log.error({ error: error.message }, 'KPI InfluxDB connection test failed');
      return false;
    }
  }

  async queryData(loopId, startTime, endTime, fields = ['pv', 'op', 'sp', 'mode', 'valve_position']) {
    try {
      // Query with pivot to combine fields into single records per timestamp
      // Note: Mode is a tag in InfluxDB, so it's preserved through the pivot
      // Convert ISO strings to Flux time literals by wrapping in time()
      const fluxQuery = `
        from(bucket: "${this.config.bucket}")
          |> range(start: time(v: "${startTime}"), stop: time(v: "${endTime}"))
          |> filter(fn: (r) => r._measurement == "${this.config.measurement}")
          |> filter(fn: (r) => r.loop_id == "${loopId}")
          |> filter(fn: (r) => r._field == "pv" or r._field == "op" or r._field == "sp" or r._field == "valve_position")
          |> pivot(rowKey:["_time", "Mode"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"])
      `;

      log.debug({ loopId, startTime, endTime, fields }, 'Executing KPI InfluxDB query');

      const results = [];
      
      // Use collectRows instead of queryRaw callbacks
      const rows = await this.queryApi.collectRows(fluxQuery);
      log.debug({ loopId, rowCount: rows.length }, 'Rows collected from InfluxDB');
      
      for (const row of rows) {
        results.push({
          ts: new Date(row._time),
          loop_id: loopId,
          pv: row.pv !== undefined ? parseFloat(row.pv) : null,
          op: row.op !== undefined ? parseFloat(row.op) : null,
          sp: row.sp !== undefined ? parseFloat(row.sp) : null,
          mode: row.Mode || null, // Mode is a tag, preserved in pivot rowKey
          valve_position: row.valve_position !== undefined ? parseFloat(row.valve_position) : null,
          quality_code: 192 // Default good quality for InfluxDB data
        });
      }
      
      log.debug({ loopId, resultsCount: results.length }, 'KPI InfluxDB query completed');

      return results;
    } catch (error) {
      log.error({ loopId, startTime, endTime, error: error.message }, 'Failed to query KPI InfluxDB data');
      throw error;
    }
  }

  async queryAggregatedData(loopId, startTime, endTime, window = '1m') {
    try {
      const fluxQuery = `
        from(bucket: "${this.config.bucket}")
          |> range(start: time(v: "${startTime}"), stop: time(v: "${endTime}"))
          |> filter(fn: (r) => r._measurement == "${this.config.measurement}")
          |> filter(fn: (r) => r.loop_id == "${loopId}")
          |> filter(fn: (r) => r._field == "pv" or r._field == "op" or r._field == "sp")
          |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"])
      `;

      log.debug({ loopId, startTime, endTime, window }, 'Executing KPI aggregated InfluxDB query');

      const rows = await this.queryApi.collectRows(fluxQuery);
      const results = [];

      for (const row of rows) {
        results.push({
          bucket: new Date(row._time),
          loop_id: loopId,
          pv_avg: row.pv || null,
          op_avg: row.op || null,
          sp_avg: row.sp || null,
          pv_count: 1 // InfluxDB aggregation doesn't provide count
        });
      }

      log.debug({ loopId, count: results.length }, 'KPI InfluxDB aggregated query completed');

      return results;
    } catch (error) {
      log.error({ loopId, startTime, endTime, error: error.message }, 'Failed to query KPI aggregated InfluxDB data');
      throw error;
    }
  }

  async close() {
    try {
      // InfluxDB v2 client doesn't have a close method, connections are managed automatically
      log.info('KPI InfluxDB client closed');
    } catch (error) {
      log.error({ error: error.message }, 'Error closing KPI InfluxDB client');
    }
  }
}

export default InfluxDBClient;
