import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { Plan } from './plan.entity';

@Entity('branch_plan')
export class BranchPlan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  branch_id!: number;

  @Column({ type: 'int' })
  plan_id!: number;

  @Column({ type: 'int', default: 0 })
  amount_hired!: number;

  @Column({ type: 'timestamp' })
  start_date!: Date;

  @Column({ type: 'timestamp' })
  end_date!: Date;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'int' })
  organization_id!: number;

  @ManyToOne(() => Branch, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch?: Branch;

  @ManyToOne(() => Plan, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan?: Plan;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
