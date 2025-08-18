import { Logger } from 'pino';
import { DataSample } from '../types/index.js';

// CLPM raw sample format based on existing schema
interface CLPMRawSample {
  loop_id: string;
  timestamp: string;           // ISO string
  server_timestamp: string;    // ISO string
  quality_code: number;
  server_id: string;
  pv?: number;
  op?: number;
  sp?: number;
  mode?: number;
  valve?: number;
  source: string;
  metadata?: {
    opcua_node_ids?: Record<string, string>;
    sampling_interval?: number;
    subscription_id?: string;
    connection_quality?: string;
  };
}

interface CLPMBatchPayload {
  source: string;
  client_id: string;
  timestamp: string;
  batch_id: string;
  samples: CLPMRawSample[];
  metadata: {
    total_samples: number;
    time_range: {
      start: string;
      end: string;
    };
    quality_summary: {
      good: number;
      uncertain: number;
      bad: number;
    };
    servers: string[];
    loops: string[];
  };
}

export class DataTransformer {
  private logger: Logger;
  private clientId: string;
  private batchCounter = 0;

  constructor(logger: Logger, clientId: string = 'opcua-client') {
    this.logger = logger.child({ component: 'DataTransformer' });
    this.clientId = clientId;
  }

  /**
   * Transform OPC UA data sample to CLPM format
   */
  transformSample(sample: DataSample, nodeIdMappings?: Record<string, string>): CLPMRawSample {
    try {
      const clpmSample: CLPMRawSample = {
        loop_id: sample.loopId,
        timestamp: sample.timestamp.toISOString(),
        server_timestamp: sample.serverTimestamp?.toISOString() || '',
        quality_code: this.normalizeQualityCode(sample.qualityCode),
        server_id: sample.serverId,
        source: 'opcua'
      };

      // Add process values if present
      if (sample.pv !== undefined && sample.pv !== null) {
        clpmSample.pv = this.normalizeNumericValue(sample.pv);
      }

      if (sample.op !== undefined && sample.op !== null) {
        clpmSample.op = this.normalizeNumericValue(sample.op);
      }

      if (sample.sp !== undefined && sample.sp !== null) {
        clpmSample.sp = this.normalizeNumericValue(sample.sp);
      }

      if (sample.mode !== undefined && sample.mode !== null) {
        clpmSample.mode = this.normalizeNumericValue(sample.mode);
      }

      if (sample.valve !== undefined && sample.valve !== null) {
        clpmSample.valve = this.normalizeNumericValue(sample.valve); 
      }

      // Add metadata
      if (nodeIdMappings || sample.metadata) {
        clpmSample.metadata = {};
        
        if (nodeIdMappings) {
          clpmSample.metadata.opcua_node_ids = nodeIdMappings;
        }
        
        if (sample.metadata) {
          Object.assign(clpmSample.metadata, sample.metadata);
        }
      }

      return clpmSample;

    } catch (error) {
      this.logger.error({ error, sample }, 'Failed to transform data sample');
      throw error;
    }
  }

  /**
   * Transform batch of samples to CLPM batch payload
   */
  transformBatch(
    samples: DataSample[], 
    nodeIdMappings?: Record<string, Record<string, string>>
  ): CLPMBatchPayload {
    try {
      if (samples.length === 0) {
        throw new Error('Cannot transform empty batch');
      }

      const batchId = this.generateBatchId();
      const transformedSamples: CLPMRawSample[] = [];

      // Transform each sample
      for (const sample of samples) {
        const mappings = nodeIdMappings?.[sample.loopId];
        const transformedSample = this.transformSample(sample, mappings);
        transformedSamples.push(transformedSample);
      }

      // Calculate metadata
      const timestamps = samples.map(s => s.timestamp);
      const startTime = new Date(Math.min(...timestamps.map(t => t.getTime())));
      const endTime = new Date(Math.max(...timestamps.map(t => t.getTime())));

      const qualitySummary = this.calculateQualitySummary(samples);
      const uniqueServers = [...new Set(samples.map(s => s.serverId))];
      const uniqueLoops = [...new Set(samples.map(s => s.loopId))];

      const batchPayload: CLPMBatchPayload = {
        source: 'opcua-client',
        client_id: this.clientId,
        timestamp: new Date().toISOString(),
        batch_id: batchId,
        samples: transformedSamples,
        metadata: {
          total_samples: transformedSamples.length,
          time_range: {
            start: startTime.toISOString(),
            end: endTime.toISOString()
          },
          quality_summary: qualitySummary,
          servers: uniqueServers,
          loops: uniqueLoops
        }
      };

      this.logger.debug({
        batchId,
        sampleCount: transformedSamples.length,
        timeRange: batchPayload.metadata.time_range,
        servers: uniqueServers.length,
        loops: uniqueLoops.length
      }, 'Transformed batch');

      return batchPayload;

    } catch (error) {
      this.logger.error({ error, sampleCount: samples.length }, 'Failed to transform batch');
      throw error;
    }
  }

  /**
   * Normalize OPC UA quality code to CLPM standard
   */
  private normalizeQualityCode(opcuaQuality: number): number {
    // OPC UA quality codes are 32-bit values
    // CLPM uses simplified quality codes:
    // 0 = Good, 1 = Uncertain, 2 = Bad

    // OPC UA Good quality codes start with 0x0 (first 2 bits = 00)
    if ((opcuaQuality & 0xC0000000) === 0x00000000) {
      return 0; // Good
    }
    
    // OPC UA Uncertain quality codes start with 0x4 (first 2 bits = 01)
    if ((opcuaQuality & 0xC0000000) === 0x40000000) {
      return 1; // Uncertain
    }
    
    // OPC UA Bad quality codes start with 0x8 (first 2 bits = 10)
    return 2; // Bad
  }

  /**
   * Normalize numeric values
   */
  private normalizeNumericValue(value: any): number {
    if (typeof value === 'number') {
      // Handle special float values
      if (!isFinite(value)) {
        return 0; // or null, depending on CLPM requirements
      }
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isFinite(parsed) ? parsed : 0;
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    // For other types, try to convert or default to 0
    const converted = Number(value);
    return isFinite(converted) ? converted : 0;
  }

  /**
   * Calculate quality summary for batch
   */
  private calculateQualitySummary(samples: DataSample[]): {
    good: number;
    uncertain: number;
    bad: number;
  } {
    const summary = { good: 0, uncertain: 0, bad: 0 };

    for (const sample of samples) {
      const normalizedQuality = this.normalizeQualityCode(sample.qualityCode);
      
      switch (normalizedQuality) {
        case 0:
          summary.good++;
          break;
        case 1:
          summary.uncertain++;
          break;
        case 2:
          summary.bad++;
          break;
      }
    }

    return summary;
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    const timestamp = Date.now();
    const counter = (++this.batchCounter).toString().padStart(4, '0');
    return `${this.clientId}-${timestamp}-${counter}`;
  }

  /**
   * Validate transformed sample
   */
  validateSample(sample: CLPMRawSample): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!sample.loop_id) {
      errors.push('Missing loop_id');
    }

    if (!sample.timestamp) {
      errors.push('Missing timestamp');
    } else {
      // Validate timestamp format
      try {
        new Date(sample.timestamp);
      } catch {
        errors.push('Invalid timestamp format');
      }
    }

    if (!sample.server_timestamp) {
      errors.push('Missing server_timestamp');
    }

    if (sample.quality_code === undefined || sample.quality_code === null) {
      errors.push('Missing quality_code');
    } else if (![0, 1, 2].includes(sample.quality_code)) {
      errors.push('Invalid quality_code (must be 0, 1, or 2)');
    }

    if (!sample.server_id) {
      errors.push('Missing server_id');
    }

    if (!sample.source) {
      errors.push('Missing source');
    }

    // At least one process value should be present
    const hasProcessValue = [
      sample.pv, sample.op, sample.sp, sample.mode, sample.valve
    ].some(value => value !== undefined && value !== null);

    if (!hasProcessValue) {
      errors.push('At least one process value (pv, op, sp, mode, valve) must be present');
    }

    // Validate numeric values
    const numericFields = ['pv', 'op', 'sp', 'mode', 'valve'] as const;
    for (const field of numericFields) {
      const value = sample[field];
      if (value !== undefined && value !== null && !isFinite(value)) {
        errors.push(`Invalid ${field}: must be a finite number`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate batch payload
   */
  validateBatch(batch: CLPMBatchPayload): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!batch.source) {
      errors.push('Missing source');
    }

    if (!batch.client_id) {
      errors.push('Missing client_id');
    }

    if (!batch.batch_id) {
      errors.push('Missing batch_id');
    }

    if (!batch.timestamp) {
      errors.push('Missing timestamp');
    }

    if (!Array.isArray(batch.samples)) {
      errors.push('Samples must be an array');
    } else if (batch.samples.length === 0) {
      errors.push('Batch must contain at least one sample');
    } else {
      // Validate each sample
      for (let i = 0; i < batch.samples.length; i++) {
        const sampleValidation = this.validateSample(batch.samples[i]);
        if (!sampleValidation.valid) {
          errors.push(`Sample ${i}: ${sampleValidation.errors.join(', ')}`);
        }
      }
    }

    // Validate metadata
    if (!batch.metadata) {
      errors.push('Missing metadata');
    } else {
      if (batch.metadata.total_samples !== batch.samples.length) {
        errors.push('Metadata total_samples does not match actual sample count');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get transformation statistics
   */
  getStatistics(): {
    batchesTransformed: number;
    samplesTransformed: number;
    averageBatchSize: number;
    qualityDistribution: { good: number; uncertain: number; bad: number };
  } {
    // This would track actual metrics in a real implementation
    return {
      batchesTransformed: this.batchCounter,
      samplesTransformed: 0, // Would be tracked
      averageBatchSize: 0, // Would be calculated
      qualityDistribution: { good: 0, uncertain: 0, bad: 0 } // Would be tracked
    };
  }
}