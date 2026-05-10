import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, FindOptionsWhere } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from './entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFiltersDto } from './dto/user-filters.dto';
import { Organization } from '../organizations/entities/organization.entity';
import { UserRole } from '../../common/enums';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>
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
      organization_id,
      branch_id,
    } = filters;

    const qb = this.usersRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.name',
        'user.email',
        'user.document',
        'user.role_id',
        'user.is_verified',
        'user.created_at',
        'user.updated_at',
        'user.organization_id',
      ])
      .leftJoinAndSelect('user.branches', 'branch')
      .where('user.deleted = :deleted', { deleted })
      .orderBy('user.created_at', 'DESC')
      .take(limit)
      .skip(offset);

    if (id !== undefined) {
      qb.andWhere('user.id = :id', { id });
    }

    if (email) {
      qb.andWhere('user.email ILIKE :email', { email: `%${email}%` });
    }

    if (is_verified !== undefined) {
      qb.andWhere('user.is_verified = :is_verified', { is_verified });
    }

    if (organization_id !== undefined) {
      qb.andWhere('user.organization_id = :organization_id', { organization_id });
    }

    if (branch_id !== undefined) {
      // Subquery sobre la tabla de unión para no afectar qué branches se cargan
      qb.andWhere(
        'user.id IN (SELECT ub.user_id FROM users_branches ub WHERE ub.branch_id = :branch_id)',
        { branch_id },
      );
    }

    const [users, total] = await qb.getManyAndCount();
    return { users, total };
  }

  async findById(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['organization'],
    });

    if (!user) {
      throw new NotFoundException('User not found with id: ' + id);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async searchUserByCondition(
    where: FindOptionsWhere<User>,
    password?: string,
    select: (keyof User)[] = ['id'],
  ): Promise<Partial<User> | null> {
    const selectedFields = password
      ? Array.from(new Set<keyof User>([...select, 'password']))
      : select;

    const user = await this.usersRepository.findOne({
      where,
      select: selectedFields,
    });

    if (!user) {
      return null;
    }

    if (password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return null;
      }
      const { password: _password, ...safeUser } = user;
      return safeUser;
    }

    return user;
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
    await this.usersRepository.manager.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const propertyRepository = manager.getRepository(Property);

      const user = await userRepository.findOne({
        where: { id },
        relations: ['organization', 'organization.admin_user'],
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const organizationAdminId = user.organization?.admin_user?.id;
      const isOrganizationAdmin = organizationAdminId === user.id;
      const isAdminUser = user.role_id === UserRole.USER_ROL_ADMIN || isOrganizationAdmin;

      if (isAdminUser) {
        throw new BadRequestException('admin user cannot be deleted');
      }

      const propertyWhereConditions = user.organization?.id
        ? { user_id: id, organization_id: user.organization.id }
        : { user_id: id };

      const assignedPropertiesCount = await propertyRepository.count({
        where: propertyWhereConditions,
      });

      if (assignedPropertiesCount > 0) {
        if (!organizationAdminId) {
          throw new BadRequestException('No se pudieron reasignar las propiedades porque la organización no tiene admin_user');
        }

        await propertyRepository.update(propertyWhereConditions, {
          user_id: organizationAdminId,
        });
      }

      const result = await userRepository.delete(id);
      if (result.affected === 0) {
        throw new NotFoundException('User not found');
      }
    });
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
  async setEmailVerificationToken(userId: number, manager?: EntityManager): Promise<string> {
    const repository = manager ? manager.getRepository(User) : this.usersRepository;
    
    const user = await repository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found with id: ' + userId);
    }
    
    const token = this.generateEmailVerificationToken();
    user.email_verification_token = token;

    await repository.save(user);
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

  async changePassword(
    id: number,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false, message: 'id invalido' };
    }

    if (!oldPassword || !newPassword) {
      return { success: false, message: 'oldPassword y newPassword son obligatorios' };
    }

    const user = await this.usersRepository.findOne({
      where: { id, deleted: false },
      select: ['id', 'password'],
    });

    if (!user) {
      return { success: false, message: 'Usuario no encontrado' };
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      return { success: false, message: 'La contraseña actual no es correcta' };
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.save(user);

    return { success: true, message: 'Contraseña actualizada correctamente' };
  }

  async updatePassword(
    user_id: number,
    newPassword: string,
    adminId: number,
  ): Promise<{ success: boolean; message: string }> {
    if (!Number.isInteger(user_id) || user_id <= 0) {
      return { success: false, message: 'user_id invalido' };
    }

    const [admin, user] = await Promise.all([
      this.usersRepository.findOne({
        where: { id: adminId, deleted: false },
        select: ['id', 'organization_id'],
      }),
      this.usersRepository.findOne({
        where: { id: user_id, deleted: false },
        select: ['id', 'password', 'organization_id'],
      }),
    ]);

    if (!user) {
      return { success: false, message: 'Usuario no encontrado' };
    }

    if (!admin || admin.organization_id !== user.organization_id) {
      return { success: false, message: 'No tienes permisos para modificar este usuario' };
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.save(user);

    return { success: true, message: 'Contraseña actualizada correctamente' };
  }

  async changeEmail(
    userId: number,
    newEmail: string,
  ): Promise<{ success: boolean; message: string; newEmail?: string; name?: string }> {
    const existing = await this.usersRepository.findOne({
      where: { email: newEmail, deleted: false },
      select: ['id'],
    });

    if (existing) {
      return { success: false, message: 'El nuevo email ya está en uso' };
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId, deleted: false },
      select: ['id', 'email', 'name'],
    });

    if (!user) {
      return { success: false, message: 'Usuario no encontrado' };
    }

    user.email = newEmail;
    await this.usersRepository.save(user);

    return { success: true, message: 'Email actualizado correctamente', newEmail, name: user.name };
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

  async addBranchToUser(userId: number, branchId: number): Promise<void> {
    await this.usersRepository
      .createQueryBuilder()
      .relation(User, 'branches')
      .of(userId)
      .add(branchId);
  }
}
