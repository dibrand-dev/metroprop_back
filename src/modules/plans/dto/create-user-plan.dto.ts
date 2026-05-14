import { IsInt, Min } from 'class-validator';

export class CreateUserPlanDto {
  @IsInt()
  plan_id!: number;

  @IsInt()
  @Min(0)
  amount_hired!: number;
}
