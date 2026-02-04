import { Injectable, BadRequestException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { BranchesService } from "../branches/branches.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { UsersService } from "../users/users.service";
import { SimpleRegistrationDto } from "./dto/simple-registration.dto";
import { ProfessionalRegistrationDto } from "./dto/professional-registration.dto";

@Injectable()
export class RegistrationService {
  constructor(
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
    private readonly branchesService: BranchesService,
    private readonly dataSource: DataSource, // para transacciones
  ) {}

  async registerProfessional(dto: ProfessionalRegistrationDto) {
    return this.dataSource.transaction(async manager => {
      // 1. Crear organización
      const organization = await this.organizationsService.create({
        company_name: dto.company_name,
        social_reason: dto.social_reason,
        phone: dto.phone,
        email: dto.email,
        cuit: dto.cuit,
        fiscal_condition: dto.fiscal_condition,
      });

      // 2. Crear branch
      const branch = await this.branchesService.create({
        branch_name: dto.company_name,
        email: dto.email,
        phone: dto.phone,
        organization,
      });

      // 3. Crear usuario
      const user = await this.usersService.create({
        email: dto.email,
        password: dto.password,
        name: dto.name,
        phone: dto.phone,
        organizationId: organization.id,
        branchIds: [branch.id],
      });

      await this.organizationsService.update(organization.id, { adminUserId: user.id });

      return { user, organization, branch };
    });
  }

  async registerSimple(dto: SimpleRegistrationDto) {
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      name: dto.email,
    });

    return { user };
  }
}