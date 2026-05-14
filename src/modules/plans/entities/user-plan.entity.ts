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

  @Column({ type: 'timestamp' })
  start_date!: Date;

  @Column({ type: 'timestamp' })
  end_date!: Date;

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
