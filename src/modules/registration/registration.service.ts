import { Injectable, BadRequestException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { BranchesService } from "../branches/branches.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { UsersService } from "../users/users.service";
import { EmailService } from "../../common/email/email.service";
import { SimpleRegistrationDto } from "./dto/simple-registration.dto";
import { ProfessionalRegistrationDto } from "./dto/professional-registration.dto";
import { GoogleOAuthDto } from "./dto/google-oauth.dto";

@Injectable()
export class RegistrationService {
  constructor(
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
    private readonly branchesService: BranchesService,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource, // para transacciones
  ) {}

  async registerOrLoginWithGoogle(dto: GoogleOAuthDto) {
    // Buscar usuario por google_id
    let user = await this.usersService['usersRepository'].findOne({ where: { google_id: dto.google_id } });
    if (!user && dto.email) {
      // Si no existe, buscar por email (por si ya existe con email pero no tiene google_id)
      user = await this.usersService['usersRepository'].findOne({ where: { email: dto.email } });
      if (user) {
        user.google_id = dto.google_id;
        await this.usersService['usersRepository'].save(user);
      }
    }
    if (!user) {
      // Crear usuario nuevo
      user = this.usersService['usersRepository'].create({
        google_id: dto.google_id,
        email: dto.email,
        name: dto.name || dto.email,
        avatar: dto.avatar,
        password: Math.random().toString(36).slice(-8), // password random, no se usa
        is_verified: true,
      });
      user = await this.usersService['usersRepository'].save(user);
    }
    // Aquí puedes generar y devolver un token si usas JWT, o solo el usuario
    return { user };
  }

  async registerProfessional(dto: ProfessionalRegistrationDto) {
    return this.dataSource.transaction(async manager => {
      try {

        // 1. Crear organización
        const organization = await this.organizationsService.create({
          company_name: dto.company_name,
          social_reason: dto.social_reason,
          phone: dto.phone,
          email: dto.email,
          cuit: dto.cuit,
          fiscal_condition: dto.fiscal_condition,
        });

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
        
        // 4. Generar token y enviar email de bienvenida profesional
        try {
          const verificationToken = await this.usersService.setEmailVerificationToken(user.id);
          await this.emailService.sendProfessionalWelcomeEmail(user.email, user.name, verificationToken);
        } catch (emailError) {
          // No fallar el registro por error de email, solo loggear
          console.error('Error sending professional welcome email:', emailError);
        }
        
        return { user, organization, branch };
      } catch (error) {
        throw error;
      }
    });
  }

  async registerSimple(dto: SimpleRegistrationDto) {
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      name: dto.email,
    });

    // Enviar email de bienvenida
    try {
      const verificationToken = await this.usersService.setEmailVerificationToken(user.id);
      await this.emailService.sendWelcomeEmail(user.email, user.name, verificationToken);
    } catch (emailError) {
      // No fallar el registro por error de email, solo loggear
      console.error('Error sending welcome email:', emailError);
    }

    return { user };
  }
}