import { InfluxDB, Point } from '@influxdata/influxdb-client';
import pino from 'pino';

const log = pino({ name: 'influxdb-client' });

export class InfluxDBClient {
  constructor(config) {
    this.url = config.url;
    this.token = config.token;
    this.org = config.org;
    this.bucket = config.bucket;
    this.measurement = config.measurement;
    
    this.client = new InfluxDB({ url: this.url, token: this.token });
    this.queryApi = this.client.getQueryApi(this.org);
  }

  async testConnection() {
    try {
      log.info({ url: this.url, org: this.org, bucket: this.bucket }, 'Testing InfluxDB connection');
      const query = `from(bucket: "${this.bucket}") |> range(start: -1m) |> limit(n: 1)`;

      const rows = await this.queryApi.collectRows(query);
      const hasData = rows.length > 0;

      log.info({ hasData }, 'InfluxDB test query result');
      // Connection is successful even if no data exists
      return true;
    } catch (error) {
      log.error({ error: error.message, stack: error.stack, url: this.url }, 'InfluxDB connection test failed');
      return false;
    }
  }

  async queryData(loopId, startTime, endTime, fields = ['pv', 'op', 'sp', 'mode', 'valve_position']) {
    try {
      // Query with pivot to combine fields into single records per timestamp
      // Convert ISO strings to Flux time literals by wrapping in time()
      const query = `
        from(bucket: "${this.bucket}")
          |> range(start: time(v: "${startTime}"), stop: time(v: "${endTime}"))
          |> filter(fn: (r) => r._measurement == "${this.measurement}")
          |> filter(fn: (r) => r.loop_id == "${loopId}")
          |> filter(fn: (r) => r._field == "pv" or r._field == "op" or r._field == "sp" or r._field == "valve_position")
          |> pivot(rowKey:["_time", "Mode"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"])
      `;

      log.debug({ loopId, startTime, endTime }, 'Executing InfluxDB query');

      // Use collectRows instead of queryRaw callbacks
      const rows = await this.queryApi.collectRows(query);
      const results = [];
      
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

      log.debug({ loopId, count: results.length }, 'Retrieved data points from InfluxDB');
      return results;
    } catch (error) {
      log.error({ error: error.message, loopId }, 'Error querying data');
      throw error;
    }
  }

  async queryAggregatedData(loopId, startTime, endTime, window = '1m') {
    try {
      const query = `
        from(bucket: "${this.bucket}")
          |> range(start: time(v: "${startTime}"), stop: time(v: "${endTime}"))
          |> filter(fn: (r) => r._measurement == "${this.measurement}")
          |> filter(fn: (r) => r.loop_id == "${loopId}")
          |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
          |> sort(columns: ["_time"])
      `;

      log.debug({ loopId, startTime, endTime, window }, 'Executing aggregated InfluxDB query');
      
      const rows = await this.queryApi.collectRows(query);
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
      
      log.debug({ loopId, count: results.length }, 'Retrieved aggregated data points from InfluxDB');
      return results;
    } catch (error) {
      log.error({ loopId, error: error.message }, 'Error querying aggregated data');
      throw error;
    }
  }

  async getDataRange(loopId) {
    try {
      // Get first data point
      const firstQuery = `
        from(bucket: "${this.bucket}")
          |> range(start: -30d)
          |> filter(fn: (r) => r._measurement == "${this.measurement}")
          |> filter(fn: (r) => r.loop_id == "${loopId}")
          |> first()
      `;

      // Get last data point
      const lastQuery = `
        from(bucket: "${this.bucket}")
          |> range(start: -30d)
          |> filter(fn: (r) => r._measurement == "${this.measurement}")
          |> filter(fn: (r) => r.loop_id == "${loopId}")
          |> last()
      `;

      let firstResult = null;
      let lastResult = null;

      // Query first data point
      await this.queryApi.queryRaw(firstQuery, {
        next: (row, tableMeta) => {
          firstResult = tableMeta.toObject(row);
        },
        error: (error) => {
          log.error('Error getting first data point:', error);
        }
      });

      // Query last data point
      await this.queryApi.queryRaw(lastQuery, {
        next: (row, tableMeta) => {
          lastResult = tableMeta.toObject(row);
        },
        error: (error) => {
          log.error('Error getting last data point:', error);
        }
      });

      if (!firstResult || !lastResult) {
        throw new Error('No data found for loop');
      }

      return {
        start: new Date(firstResult._time),
        end: new Date(lastResult._time)
      };
    } catch (error) {
      log.error('Error getting data range:', error);
      throw error;
    }
  }

  async writeData(points) {
    try {
      const writeApi = this.client.getWriteApi(this.org, this.bucket, 'ms');
      
      for (const point of points) {
        writeApi.writePoint(point);
      }
      
      await writeApi.flush();
      await writeApi.close();
      
      log.info(`Written ${points.length} data points`);
    } catch (error) {
      log.error('Error writing data:', error);
      throw error;
    }
  }

  async close() {
    // Note: InfluxDB client doesn't have a close method in this version
    // The client will be garbage collected automatically
    log.info('InfluxDB client closing');
  }
}
