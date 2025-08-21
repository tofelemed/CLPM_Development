import { Injectable, Logger } from '@nestjs/common';
import { InfluxDB } from '@influxdata/influxdb-client';

@Injectable()
export class InfluxDBService {
  private readonly logger = new Logger(InfluxDBService.name);
  private client: InfluxDB;
  private queryApi: any;

  constructor() {
    const url = process.env.INFLUXDB_URL || 'http://72.255.34.69:8086/';
    const token = process.env.INFLUXDB_TOKEN || '4eYvsu8wZCJ6tKuE2sxvFHkvYFwSMVK0011hEEiojvejzpSaij86vYQomN_12au6eK-2MZ6Knr-Sax201y70w==';
    const org = process.env.INFLUXDB_ORG || 'some_org';

    this.client = new InfluxDB({ url, token });
    this.queryApi = this.client.getQueryApi(org);
  }

  async testConnection(): Promise<boolean> {
    try {
      const query = `buckets()`;
      const results: any[] = [];
      
      await this.queryApi.queryRaw(query, {
        next: (row: any, tableMeta: any) => {
          const o = tableMeta.toObject(row);
          results.push(o);
        },
        error: (error: any) => {
          this.logger.error('InfluxDB query error:', error);
          throw error;
        },
        complete: () => {
          this.logger.log('InfluxDB connection test successful');
        }
      });

      return results.length > 0;
    } catch (error) {
      this.logger.error('InfluxDB connection test failed:', error);
      return false;
    }
  }

  async queryData(
    loopId: string,
    startTime: string,
    endTime: string,
    fields: string[] = ['pv', 'op', 'sp', 'mode', 'valve_position']
  ): Promise<any[]> {
    try {
      const bucket = process.env.INFLUXDB_BUCKET || 'some_data';
      const measurement = process.env.INFLUXDB_MEASUREMENT || 'control_loops';
      
      // Start with a very simple query to test connectivity
      const query = `
        from(bucket: "${bucket}")
          |> range(start: -1h)
          |> filter(fn: (r) => r.loop_id == "${loopId}")
          |> limit(n: 10)
      `;

      this.logger.debug(`Executing Flux query: ${query}`);

      const results: any[] = [];
      
      await this.queryApi.queryRaw(query, {
        next: (row: any, tableMeta: any) => {
          const o = tableMeta.toObject(row);
          results.push(o);
        },
        error: (error: any) => {
          this.logger.error('InfluxDB query error:', error);
          throw error;
        },
        complete: () => {
          this.logger.log(`Retrieved ${results.length} data points for loop ${loopId}`);
        }
      });

      return results;
    } catch (error) {
      this.logger.error('Error querying InfluxDB data:', error);
      throw error;
    }
  }

  async queryAggregatedData(
    loopId: string,
    startTime: string,
    endTime: string,
    window: string = '1m'
  ): Promise<any[]> {
    try {
      const bucket = process.env.INFLUXDB_BUCKET || 'some_data';
      const measurement = process.env.INFLUXDB_MEASUREMENT || 'control_loops';
      
      const query = `
        from(bucket: "${bucket}")
          |> range(start: ${startTime}, stop: ${endTime})
          |> filter(fn: (r) => r._measurement == "${measurement}")
          |> filter(fn: (r) => r.loop_id == "${loopId}")
          |> filter(fn: (r) => r._field == "pv" or r._field == "op" or r._field == "sp")
          |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      `;

      const results: any[] = [];
      
      await this.queryApi.queryRaw(query, {
        next: (row: any, tableMeta: any) => {
          const o = tableMeta.toObject(row);
          results.push(o);
        },
        error: (error: any) => {
          this.logger.error('InfluxDB aggregated query error:', error);
          throw error;
        },
        complete: () => {
          this.logger.log(`Retrieved ${results.length} aggregated data points for loop ${loopId}`);
        }
      });

      return results;
    } catch (error) {
      this.logger.error('Error querying InfluxDB aggregated data:', error);
      throw error;
    }
  }

  async getDataRange(loopId: string): Promise<{ start: Date; end: Date }> {
    try {
      const bucket = process.env.INFLUXDB_BUCKET || 'some_data';
      const measurement = process.env.INFLUXDB_MEASUREMENT || 'control_loops';
      
      // Get first data point
      const firstQuery = `
        from(bucket: "${bucket}")
          |> range(start: -30d)
          |> filter(fn: (r) => r._measurement == "${measurement}")
          |> filter(fn: (r) => r.loop_id == "${loopId}")
          |> first()
      `;

      // Get last data point
      const lastQuery = `
        from(bucket: "${bucket}")
          |> range(start: -30d)
          |> filter(fn: (r) => r._measurement == "${measurement}")
          |> filter(fn: (r) => r.loop_id == "${loopId}")
          |> last()
      `;

      let firstResult: any = null;
      let lastResult: any = null;

      // Query first data point
      await this.queryApi.queryRaw(firstQuery, {
        next: (row: any, tableMeta: any) => {
          firstResult = tableMeta.toObject(row);
        },
        error: (error: any) => {
          this.logger.error('Error getting first data point:', error);
        }
      });

      // Query last data point
      await this.queryApi.queryRaw(lastQuery, {
        next: (row: any, tableMeta: any) => {
          lastResult = tableMeta.toObject(row);
        },
        error: (error: any) => {
          this.logger.error('Error getting last data point:', error);
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
      this.logger.error('Error getting data range:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    // Note: InfluxDB client doesn't have a close method in this version
    // The client will be garbage collected automatically
    this.logger.log('InfluxDB service closing');
  }
}
