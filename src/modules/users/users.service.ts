import { MediaService } from '../../common/media/media.service';
import { USER_IMAGE_FOLDER } from '../../common/constants';
import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFiltersDto } from './dto/user-filters.dto';
import { Organization } from '../organizations/entities/organization.entity';
import { UserRole } from '../../common/enums';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly mediaService: MediaService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException(`El correo ${createUserDto.email} ya se encuentra registrado en el sistema.`);
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
      role_id: createUserDto.role_id ?? UserRole.USER_ROL_SELLER,
      organization: createUserDto.organizationId
        ? ({ id: createUserDto.organizationId } as Organization)
        : undefined,
    });
    const saved = await this.usersRepository.save(user);
    if (createUserDto.branchIds && createUserDto.branchIds.length > 0) {
      await this.usersRepository
        .createQueryBuilder()
        .relation(User, 'branches')
        .of(saved)
        .add(createUserDto.branchIds);
    }
    return saved;
  }

  async findAll(filters: UserFiltersDto = {}) {
    const {
      id,
      limit = 10,
      offset = 0,
      email,
      is_verified,
      deleted = false,
      organization_id
    } = filters;

    const whereConditions: any = {
      deleted
    };

    if (id !== undefined) {
      whereConditions.id = id;
    }

    if (email) {
      whereConditions.email = Like(`%${email}%`);
    }

    if (is_verified !== undefined) {
      whereConditions.is_verified = is_verified;
    }

    if (organization_id !== undefined) {
      whereConditions.organization = { id: organization_id };
    }

    const [users, total] = await this.usersRepository.findAndCount({
      where: whereConditions,
      skip: offset,
      take: limit,
      select: [
        'id',
        'name',
        'email',
        'role_id',
        'is_verified',
        'created_at',
        'updated_at',
      ],
      order: {
        created_at: 'DESC'
      }
    });

    return { users, total };
  }

  async findById(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['organization'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  /**
   * Busca un usuario por email incluyendo la relación de organización (si existe).
   * Útil para distinguir entre usuario profesional y simple.
   */
  async findByEmailWithOrganization(email: string, safe: boolean = false): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { email },
      relations: [
        'organization',
        'organization.branches',
        'organization.branches.users',
      ],
    });

    if (!user) return null;

    if (safe) {
      // Excluir campos sensibles mediante destructuring
      const { password, email_verification_token, password_reset_token, password_reset_token_expires, ...safeUser } = user;
      return safeUser as User;
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if ((updateUserDto as any).password) {
      (updateUserDto as any).password = await bcrypt.hash((updateUserDto as any).password, 10);
    }

    Object.assign(user, updateUserDto);
    if (updateUserDto.branchIds) {
      await this.usersRepository
        .createQueryBuilder()
        .relation(User, 'branches')
        .of(user)
        .set(updateUserDto.branchIds);
    }

    return this.usersRepository.save(user);
  }

  async remove(id: number): Promise<void> {
    const result = await this.usersRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Genera un token de verificación de email
   */
  generateEmailVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Genera un token para reset de password
   */
  generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Establece el token de verificación de email (sin expiración)
   */
  async setEmailVerificationToken(userId: number): Promise<string> {
    const user = await this.findById(userId);
    const token = this.generateEmailVerificationToken();

    user.email_verification_token = token;

    await this.usersRepository.save(user);
    return token;
  }

  /**
   * Verifica el email usando el token
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const user = await this.usersRepository.findOne({
      where: { email_verification_token: token }
    });

    if (!user) {
      return { success: false, message: 'Token de verificación inválido' };
    }

    user.is_verified = true;
    user.email_verification_token = undefined;

    await this.usersRepository.save(user);
    return { success: true, message: 'Email verificado correctamente' };
  }

  /**
   * Establece el token de reset de password
   */
  async setPasswordResetToken(email: string): Promise<{ user: User; token: string } | null> {
    const user = await this.findByEmail(email);
    
    if (!user) {
      return null;
    }

    const token = this.generatePasswordResetToken();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hora

    user.password_reset_token = token;
    user.password_reset_token_expires = expires;

    await this.usersRepository.save(user);
    return { user, token };
  }

  /**
   * Validar token de reset de password sin cambiar nada
   */
  async validateResetToken(token: string): Promise<{ valid: boolean; user?: { email: string; name: string }; message?: string }> {
    const user = await this.usersRepository.findOne({
      where: { password_reset_token: token },
      select: ['id', 'email', 'name', 'password_reset_token_expires']
    });

    if (!user) {
      return { 
        valid: false, 
        message: 'El enlace de recuperación no es válido o ya fue utilizado' 
      };
    }

    if (!user.password_reset_token_expires || new Date() > user.password_reset_token_expires) {
      return { 
        valid: false, 
        message: 'El enlace de recuperación ha expirado. Solicite un nuevo enlace de recuperación' 
      };
    }

    return {
      valid: true,
      user: {
        email: user.email,
        name: user.name
      }
    };
  }

  /**
   * Reset de password usando token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const user = await this.usersRepository.findOne({
      where: { password_reset_token: token }
    });

    if (!user) {
      return { success: false, message: 'Token de reset de password inválido' };
    }

    if (!user.password_reset_token_expires || new Date() > user.password_reset_token_expires) {
      return { success: false, message: 'Token de reset de password expirado' };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    user.password = hashedPassword;
    user.password_reset_token = undefined;
    user.password_reset_token_expires = undefined;

    await this.usersRepository.save(user);
    return { success: true, message: 'Contraseña actualizada correctamente' };
  }

  /**
   * Solicitar reset de password (moved from registration service)
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string; user?: User; token?: string }> {
    try {
      const result = await this.setPasswordResetToken(email);
      
      if (!result) {
        // Por seguridad, no revelar si el email existe o no
        return { 
          success: true, 
          message: 'Si el email existe en nuestro sistema, recibirás un enlace de recuperación' 
        };
      }

      const { user, token } = result;
      
      // Nota: El envío del email debe ser manejado en el controller/service que tenga acceso al EmailService
      return { 
        success: true, 
        user,
        token,
        message: 'Si el email existe en nuestro sistema, recibirás un enlace de recuperación' 
      };
    } catch (error) {
      console.error('Error in requestPasswordReset:', error);
      return { 
        success: false, 
        message: 'Error interno. Intenta nuevamente más tarde.' 
      };
    }
  }
}
