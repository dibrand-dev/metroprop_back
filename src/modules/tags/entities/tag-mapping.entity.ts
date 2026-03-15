import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tags_mapping')
export class TagMapping {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  partner?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  metroprop_tag_id?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  partner_tag_id?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  partner_tag_name?: string;
}