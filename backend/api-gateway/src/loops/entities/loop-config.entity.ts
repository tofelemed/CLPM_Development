import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Loop } from './loop.entity';

@Entity({ name: 'loop_config' })
export class LoopConfig {
  @PrimaryColumn({ name: 'loop_id', type: 'uuid' }) loopId!: string;
  
  // KPI Thresholds  
  @Column({ name: 'sf_low', type: 'decimal', precision: 4, scale: 3, nullable: true }) sfLow?: number;
  @Column({ name: 'sf_high', type: 'decimal', precision: 4, scale: 3, nullable: true }) sfHigh?: number;
  @Column({ name: 'sat_high', type: 'decimal', precision: 4, scale: 3, nullable: true }) satHigh?: number;
  @Column({ name: 'rpi_low', type: 'decimal', precision: 4, scale: 3, nullable: true }) rpiLow?: number;
  @Column({ name: 'rpi_high', type: 'decimal', precision: 4, scale: 3, nullable: true }) rpiHigh?: number;
  @Column({ name: 'osc_limit', type: 'decimal', precision: 4, scale: 3, nullable: true }) oscLimit?: number;
  
  // Monitoring Configuration
  @Column({ name: 'kpi_window', type: 'int', default: 60 }) kpiWindow!: number; // minutes
  @Column({ name: 'importance', type: 'smallint', default: 5 }) importance!: number;
  @Column({ name: 'sampling_interval', type: 'int', default: 200, nullable: true }) samplingInterval?: number; // milliseconds
  
  // Alarm Thresholds
  @Column({ name: 'service_factor_low_alarm', type: 'decimal', precision: 5, scale: 3, default: 0.75, nullable: true }) serviceFacorLowAlarm?: number;
  @Column({ name: 'pi_low_alarm', type: 'decimal', precision: 5, scale: 3, default: 0.65, nullable: true }) piLowAlarm?: number;
  @Column({ name: 'oscillation_high_alarm', type: 'decimal', precision: 5, scale: 3, default: 0.4, nullable: true }) oscillationHighAlarm?: number;
  @Column({ name: 'stiction_high_alarm', type: 'decimal', precision: 5, scale: 3, default: 0.5, nullable: true }) stictionHighAlarm?: number;
  
  // OPC UA Integration
  @Column({ name: 'connection_id', type: 'varchar', length: 255, nullable: true }) connectionId?: string;
  @Column({ name: 'monitored_items', type: 'jsonb', nullable: true }) monitoredItems?: any;
  
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()', nullable: true }) createdAt?: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
  
  @OneToOne(() => Loop)
  @JoinColumn({ name: 'loop_id' })
  loop!: Loop;
}