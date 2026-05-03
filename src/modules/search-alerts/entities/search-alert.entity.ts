import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum SearchAlertStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('search_alerts')
@Index('idx_search_alerts_user_id', ['user_id'])
@Index('idx_search_alerts_status', ['status'])
export class SearchAlert {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  user_id!: number;

  @Column({ type: 'text' })
  filters!: string; // JSON string con los filtros seleccionados

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: SearchAlertStatus.ACTIVE,
  })
  status!: SearchAlertStatus;

  @Column({ type: 'timestamp', nullable: true })
  last_email_sent?: Date | null;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
