import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Plan } from './plan.entity';

@Entity('user_plan')
export class UserPlan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  user_id!: number;

  @Column({ type: 'int' })
  plan_id!: number;

  @Column({ type: 'int', default: 0 })
  amount_hired!: number;

  @Column({ type: 'int', nullable: true })
  plan_price_paid?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  plan_name_hired?: string;

  @Column({ type: 'jsonb', nullable: true })
  mercadopago_response?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mercadopago_payment_id?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mercadopago_preapproval_id?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mercadopago_external_reference?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  mercadopago_status?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mercadopago_status_detail?: string;

  @Column({ type: 'timestamp', nullable: true })
  mercadopago_last_status_check_at?: Date;

  @Column({ type: 'jsonb', nullable: true })
  mercadopago_last_status_payload?: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true })
  mercadopago_cancelled_at?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  status_payment?: string;

  @Column({ type: 'timestamp' })
  start_date!: Date;

  @Column({ type: 'timestamp', nullable: true })
  end_date?: Date | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'int', nullable: true })
  organization_id?: number;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Plan, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan?: Plan;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
