import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'loops' })
export class Loop {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 255 }) name!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ name: 'pv_tag', length: 255 }) pvTag!: string;
  @Column({ name: 'op_tag', length: 255 }) opTag!: string;
  @Column({ name: 'sp_tag', length: 255 }) spTag!: string;
  @Column({ name: 'mode_tag', length: 255 }) modeTag!: string;
  @Column({ name: 'valve_tag', length: 255, nullable: true }) valveTag?: string;
  @Column({ type: 'smallint', default: 5 }) importance!: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt?: Date | null;
}
