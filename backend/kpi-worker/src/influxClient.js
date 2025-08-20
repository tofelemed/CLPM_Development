import { InfluxDB } from '@influxdata/influxdb-client';
import pino from 'pino';

const log = pino({ name: 'kpi-influxdb-client' });

export class InfluxDBClient {
  constructor(config) {
    this.config = {
      url: config.url || process.env.INFLUXDB_URL || 'http://localhost:8086',
      token: config.token || process.env.INFLUXDB_TOKEN,
      org: config.org || process.env.INFLUXDB_ORG,
      bucket: config.bucket || process.env.INFLUXDB_BUCKET || 'clpm',
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
      const fieldFilters = fields.map(field => `r._field == "${field}"`).join(' or ');
      
      const fluxQuery = `
        from(bucket: "${this.config.bucket}")
          |> range(start: ${startTime}, stop: ${endTime})
          |> filter(fn: (r) => r._measurement == "${this.config.measurement}")
          |> filter(fn: (r) => r.loop_id == "${loopId}")
          |> filter(fn: (r) => ${fieldFilters})
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"])
      `;

      log.debug({ loopId, startTime, endTime, fields }, 'Executing KPI InfluxDB query');
      
      const results = [];
      await this.queryApi.queryRaw(fluxQuery, {
        next: (row, tableMeta) => {
          const o = tableMeta.toObject(row);
          results.push({
            ts: new Date(o._time),
            loop_id: loopId,
            pv: o.pv || null,
            op: o.op || null,
            sp: o.sp || null,
            mode: o.mode || null,
            valve_position: o.valve_position || null,
            quality_code: 192 // Default good quality for InfluxDB data
          });
        },
        error: (error) => {
          log.error({ error: error.message }, 'KPI InfluxDB query error');
          throw error;
        },
        complete: () => {
          log.debug({ loopId, count: results.length }, 'KPI InfluxDB query completed');
        }
      });

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
          |> range(start: ${startTime}, stop: ${endTime})
          |> filter(fn: (r) => r._measurement == "${this.config.measurement}")
          |> filter(fn: (r) => r.loop_id == "${loopId}")
          |> filter(fn: (r) => r._field == "pv" or r._field == "op" or r._field == "sp")
          |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"])
      `;

      log.debug({ loopId, startTime, endTime, window }, 'Executing KPI aggregated InfluxDB query');
      
      const results = [];
      await this.queryApi.queryRaw(fluxQuery, {
        next: (row, tableMeta) => {
          const o = tableMeta.toObject(row);
          results.push({
            bucket: new Date(o._time),
            loop_id: loopId,
            pv_avg: o.pv || null,
            op_avg: o.op || null,
            sp_avg: o.sp || null,
            pv_count: 1 // InfluxDB aggregation doesn't provide count
          });
        },
        error: (error) => {
          log.error({ error: error.message }, 'KPI InfluxDB aggregated query error');
          throw error;
        },
        complete: () => {
          log.debug({ loopId, count: results.length }, 'KPI InfluxDB aggregated query completed');
        }
      });

      return results;
    } catch (error) {
      log.error({ loopId, startTime, endTime, error: error.message }, 'Failed to query KPI aggregated InfluxDB data');
      throw error;
    }
  }

  async close() {
    try {
      this.client.close();
      log.info('KPI InfluxDB client closed');
    } catch (error) {
      log.error({ error: error.message }, 'Error closing KPI InfluxDB client');
    }
  }
}

export default InfluxDBClient;
