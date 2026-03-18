import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tokko_sync_state')
export class TokkoSyncState {
  @PrimaryGeneratedColumn()
  id!: number;

  /** The Tokko freeportal API key this state row tracks */
  @Column({ type: 'varchar', length: 500, unique: true, nullable: false })
  api_key!: string;

  /**
   * The "from date" used in the current/last batch's API call.
   * Only advanced to completed_at AFTER all items in a run are processed.
   */
  @Column({ type: 'timestamp', nullable: false, default: () => "'2000-01-01 00:00:00'" })
  sync_from_date!: Date;

  /** Current pagination offset within the active run */
  @Column({ type: 'integer', default: 0, nullable: false })
  current_offset!: number;

  /** Total items reported by the API meta for the current run */
  @Column({ type: 'integer', default: 0, nullable: false })
  total_count!: number;

  /** True when the last run finished all pages successfully */
  @Column({ type: 'boolean', default: true, nullable: false })
  is_complete!: boolean;

  /** When the current (or last) run started */
  @Column({ type: 'timestamp', nullable: true })
  started_at?: Date | null;

  /** When the last run completed all pages */
  @Column({ type: 'timestamp', nullable: true })
  completed_at?: Date | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
