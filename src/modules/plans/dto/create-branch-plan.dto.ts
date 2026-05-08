import { IsDate, IsInt, Min } from 'class-validator';

export class CreateBranchPlanDto {
  @IsInt()
  plan_id!: number;

  @IsInt()
  branch_id!: number;

  @IsInt()
  @Min(0)
  amount_hired!: number;

  @IsDate()
  start_date!: Date;

  @IsDate()
  end_date!: Date;

}
