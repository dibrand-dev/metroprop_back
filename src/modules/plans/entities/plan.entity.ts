import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Currency, PlanName } from '../../../common/enums';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn()
  id!: number;

  /** PlanName enum: 1=GRATUITO, 2=PREMIUM */
  @Column({ type: 'int' })
  plan_type!: PlanName;

  /** Price in the given currency */
  @Column({ type: 'int', default: 0 })
  price!: number;

  /** Currency code (USD, ARS, PYG, UYU, PEN) */
  @Column({ type: 'varchar', length: 3, default: Currency.USD })
  currency!: Currency;

  /** Max number of properties allowed (0 = unlimited) */
  @Column({ type: 'int', default: 0 })
  property_limit!: number;

  /** Max number of highlighted properties (destaques) allowed (0 = unlimited) */
  @Column({ type: 'int', default: 0 })
  highlight_limit!: number;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'boolean', default: false })
  deleted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
