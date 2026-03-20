import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from "@nestjs/jwt";
import { BranchesService } from "../branches/branches.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { UsersService } from "../users/users.service";
import { EmailService } from "../../common/email/email.service";
import { SimpleRegistrationDto } from "./dto/simple-registration.dto";
import { ProfessionalRegistrationDto } from "./dto/professional-registration.dto";
import { GoogleOAuthDto } from "./dto/google-oauth.dto";
import { CreateOrganizationRegistrationDto } from "./dto/create-organization-registration.dto";
import { Organization } from '../organizations/entities/organization.entity';
import { Branch } from '../branches/entities/branch.entity';
import { User } from '../users/entities/user.entity';
import { Partner } from '../partners/entities/partner.entity';
import { UserRole, ProfessionalType } from '../../common/enums';

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
    private readonly branchesService: BranchesService,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource, // para transacciones
    private readonly jwtService: JwtService,
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async registerOrLoginWithGoogle(dto: GoogleOAuthDto) {
    let user;
    let isNewUser = false;
    let wasLinked = false;

    // 1. Buscar usuario por google_id
    user = await this.usersService['usersRepository'].findOne({ where: { google_id: dto.google_id } });
    
    if (!user && dto.email) {
      // 2. Si no existe, buscar por email (usuario existente sin Google)
      user = await this.usersService['usersRepository'].findOne({ where: { email: dto.email } });
      
      if (user) {
        // Usuario existe, asociar google_id
        user.google_id = dto.google_id;
        if (dto.name && !user.name) user.name = dto.name;
        if (dto.avatar && !user.avatar) user.avatar = dto.avatar;
        user.is_verified = true; // Auto-verificar con Google
        wasLinked = true;
        await this.usersService['usersRepository'].save(user);
        console.log(`🔗 Usuario existente ${user.email} vinculado con Google ID: ${dto.google_id}`);
      }
    }
    
    if (!user) {
      // 3. Crear usuario nuevo
      user = this.usersService['usersRepository'].create({
        google_id: dto.google_id,
        email: dto.email,
        name: dto.name || dto.email,
        avatar: dto.avatar,
        password: '', 
        is_verified: true,
      });
      user = await this.usersService['usersRepository'].save(user);
      isNewUser = true;
      console.log(`🆕 Nuevo usuario creado con Google: ${user.email}`);
    }

    // 4. Generar JWT token
    const access_token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        is_verified: user.is_verified,
        google_id: user.google_id,
      },
      message: isNewUser 
        ? 'Usuario creado exitosamente con Google' 
        : wasLinked 
        ? 'Cuenta vinculada con Google exitosamente'
        : 'Login exitoso con Google'
    };
  }

  async registerProfessional(dto: ProfessionalRegistrationDto) {
    // Mapear datos del DTO al formato del método base
    const organizationData = {
      company_name: dto.company_name,
      email: dto.email,
      phone: dto.phone,
      cuit: dto.cuit,
      // Campos específicos de professional registration
      social_reason: dto.social_reason,
      fiscal_condition: dto.fiscal_condition,
    };

    const adminUser = {
      name: dto.name,
      email: dto.email,
      password: dto.password,
      phone: dto.phone,
    };

    const result = await this.createOrganizationCore(
      organizationData,
      adminUser,
      null // No partner para registration profesional
    );

    return {
      user: { id: result.admin_user_id },
      organization: { id: result.organization_id },
      branch: { id: result.branch_id }
    };
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

  /**
   * Reenvía el email de bienvenida para un usuario no verificado.
   * Si el usuario ya tiene un token, se utiliza el mismo; si no tiene
   * token (pero tampoco está validado) se genera uno nuevo.
   * Mensajes claros para cada situación.
   */
  async resendWelcomeEmail(email: string): Promise<{ success: boolean; message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    if (user.is_verified) {
      return { success: false, message: 'El usuario ya se encuentra activo' };
    }

    // token existente o nuevo
    let token = user.email_verification_token;
    if (!token) {
      token = await this.usersService.setEmailVerificationToken(user.id);
    }

    // determinar si es profesional (tiene organización) para elegir plantilla
    let isProfessional = false;
    const userWithOrg = await this.usersService.findByEmailWithOrganization(email);
    if (userWithOrg && userWithOrg.organization) {
      isProfessional = true;
    }

    try {
      if (isProfessional) {
        await this.emailService.sendProfessionalWelcomeEmail(user.email, user.name, token);
      } else {
        await this.emailService.sendWelcomeEmail(user.email, user.name, token);
      }
      return { success: true, message: 'Correo de bienvenida reenviado correctamente' };
    } catch (error) {
      console.error('Error resending welcome email:', error);
      return { success: false, message: 'Error al reenviar el correo de bienvenida' };
    }
  }

  // ================================================================
  // CREATE ORGANIZATION + BRANCH + ADMIN USER (unified method)
  // ================================================================

  async createOrganization(
    dto: CreateOrganizationRegistrationDto,
    partner: Partner,
  ): Promise<{ organization_id: number; branch_id: number; admin_user_id: number }> {
    // Mapear datos del DTO al formato del método base
    const organizationData = {
      company_name: dto.company_name,
      company_logo: dto.company_logo,
      email: dto.email || '', // Garantizar que no sea undefined
      address: dto.address || '',
      phone: dto.phone || '', // Garantizar que no sea undefined
      alternative_phone: dto.alternative_phone,
      contact_time: dto.contact_time,
      country_id: dto.country_id,
      state_id: dto.state_id,
      location_id: dto.location_id?.toString(),
      sub_location_id: dto.sublocation_id,
      professional_type: dto.professional_type,
      cuit: dto.cuit,
      external_reference: dto.external_reference,
      tokko_key: dto.tokko_key,
    };

    const adminUser = {
      name: dto.admin_name,
      email: dto.admin_email,
      password: dto.admin_name, // Usar admin_name como password por defecto
      phone: dto.admin_phone,
      avatar: dto.admin_avatar,
    };

    return this.createOrganizationCore(organizationData, adminUser, partner);
  }

  /**
   * Método base para crear organización + branch + admin user
   * Reutilizable por registerProfessional y createOrganization
   */
  private async createOrganizationCore(
    organizationData: {
      company_name: string;
      email: string;
      phone: string;
      company_logo?: string;
      address?: string;
      alternative_phone?: string;
      contact_time?: string;
      country_id?: number;
      state_id?: number;
      location_id?: string;
      sub_location_id?: number;
      professional_type?: ProfessionalType;
      cuit?: string;
      external_reference?: string;
      tokko_key?: string;
      social_reason?: string;
      fiscal_condition?: string;
    },
    adminUser: {
      name: string;
      email: string;
      password: string;
      phone?: string;
      avatar?: string;
    },
    partner: Partner | null
  ): Promise<{ organization_id: number; branch_id: number; admin_user_id: number }> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Create Organization
      const organization = manager.create(Organization, {
        company_name: organizationData.company_name,
        company_logo: organizationData.company_logo,
        email: organizationData.email,
        address: organizationData.address,
        phone: organizationData.phone,
        alternative_phone: organizationData.alternative_phone,
        contact_time: organizationData.contact_time,
        country_id: organizationData.country_id,
        state_id: organizationData.state_id,
        location_id: organizationData.location_id,
        sub_location_id: organizationData.sub_location_id,
        professional_type: organizationData.professional_type,
        cuit: organizationData.cuit,
        external_reference: organizationData.external_reference,
        tokko_key: organizationData.tokko_key,
        source_partner_id: partner?.id,
        // Campos específicos de professional registration
        social_reason: organizationData.social_reason,
        fiscal_condition: organizationData.fiscal_condition,
        deleted: false,
      });
      const savedOrg = await manager.save(Organization, organization);
      this.logger.log(`Created organization ${savedOrg.id}${partner ? ` for partner ${partner.id}` : ' (professional registration)'}`);

      // 2. Create Branch (mirror org data)
      const branch = manager.create(Branch, {
        branch_name: organizationData.company_name,
        email: organizationData.email,
        phone: organizationData.phone,
        alternative_phone: organizationData.alternative_phone,
        contact_time: organizationData.contact_time,
        address: organizationData.address,
        country_id: organizationData.country_id,
        state_id: organizationData.state_id,
        location_id: organizationData.location_id,
        sub_location_id: organizationData.sub_location_id,
        organization: savedOrg,
        deleted: false,
      });
      const savedBranch = await manager.save(Branch, branch);
      this.logger.log(`Created branch ${savedBranch.id} for organization ${savedOrg.id}`);

      // 3. Create Admin User
      // Check if user with this email already exists
      const existingUser = await manager.findOne(User, {
        where: { email: adminUser.email },
      });

      if (existingUser) {
        throw new BadRequestException(
          `El email ${adminUser.email} ya se encuentra registrado. Use otro email para el administrador.`,
        );
      }

      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(adminUser.password, 10);

      const user = manager.create(User, {
        name: adminUser.name,
        email: adminUser.email,
        password: hashedPassword,
        phone: adminUser.phone,
        avatar: adminUser.avatar,
        role_id: UserRole.USER_ROL_ADMIN,
        organization: { id: savedOrg.id } as Organization,
        is_verified: false,
      });
      const savedUser = await manager.save(User, user);

      // Link user to branch
      await manager
        .createQueryBuilder()
        .relation(User, 'branches')
        .of(savedUser)
        .add(savedBranch.id);

      // Set as org admin
      await manager.update(Organization, savedOrg.id, {
        admin_user: { id: savedUser.id } as User,
      });

      this.logger.log(`Created admin user ${savedUser.id} (${adminUser.email}) for organization ${savedOrg.id}`);

      // 4. Send welcome email (non-blocking)
      try {
        const verificationToken = await this.usersService.setEmailVerificationToken(savedUser.id);
        await this.emailService.sendProfessionalWelcomeEmail(
          savedUser.email,
          savedUser.name,
          verificationToken,
        );
        this.logger.log(`Welcome email sent to ${savedUser.email}`);
      } catch (emailError) {
        this.logger.error(`Error sending welcome email to ${savedUser.email}: ${emailError}`);
      }

      return {
        organization_id: savedOrg.id,
        admin_user_id: savedUser.id,
        branch_id: savedBranch.id
      };
    });
  }

}