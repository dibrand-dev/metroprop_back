import { Injectable, BadRequestException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtService } from "@nestjs/jwt";
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
    private readonly jwtService: JwtService,
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
}