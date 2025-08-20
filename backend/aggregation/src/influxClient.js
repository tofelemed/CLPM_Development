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
      const query = `buckets()`;
      const results = [];
      
      await this.queryApi.queryRaw(query, {
        next: (row, tableMeta) => {
          const o = tableMeta.toObject(row);
          results.push(o);
        },
        error: (error) => {
          log.error('Query error:', error);
          throw error;
        },
        complete: () => {
          log.info('Connection test successful');
        }
      });

      return results.length > 0;
    } catch (error) {
      log.error('Connection test failed:', error);
      return false;
    }
  }

  async queryData(loopId, startTime, endTime, fields = ['pv', 'op', 'sp', 'mode', 'valve_position']) {
    try {
      const fieldFilters = fields.map(field => `r._field == "${field}"`).join(' or ');
      
      const query = `
        from(bucket: "${this.bucket}")
          |> range(start: ${startTime}, stop: ${endTime})
          |> filter(fn: (r) => r._measurement == "${this.measurement}")
          |> filter(fn: (r) => r.loop_id == "${loopId}")
          |> filter(fn: (r) => ${fieldFilters})
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      `;

      const results = [];
      
      await this.queryApi.queryRaw(query, {
        next: (row, tableMeta) => {
          const o = tableMeta.toObject(row);
          results.push(o);
        },
        error: (error) => {
          log.error('Query error:', error);
          throw error;
        },
        complete: () => {
          log.info(`Retrieved ${results.length} data points for loop ${loopId}`);
        }
      });

      return results;
    } catch (error) {
      log.error('Error querying data:', error);
      throw error;
    }
  }

  async queryAggregatedData(loopId, startTime, endTime, window = '1m') {
    try {
      const query = `
        from(bucket: "${this.bucket}")
          |> range(start: ${startTime}, stop: ${endTime})
          |> filter(fn: (r) => r._measurement == "${this.measurement}")
          |> filter(fn: (r) => r.loop_id == "${loopId}")
          |> filter(fn: (r) => r._field == "pv" or r._field == "op" or r._field == "sp")
          |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      `;

      const results = [];
      
      await this.queryApi.queryRaw(query, {
        next: (row, tableMeta) => {
          const o = tableMeta.toObject(row);
          results.push(o);
        },
        error: (error) => {
          log.error('Aggregated query error:', error);
          throw error;
        },
        complete: () => {
          log.info(`Retrieved ${results.length} aggregated data points for loop ${loopId}`);
        }
      });

      return results;
    } catch (error) {
      log.error('Error querying aggregated data:', error);
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
