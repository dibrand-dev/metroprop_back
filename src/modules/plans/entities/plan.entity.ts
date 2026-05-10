import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Currency } from '../../../common/enums';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  plan_name!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  plan_description?: string;

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
