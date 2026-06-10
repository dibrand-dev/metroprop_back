import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFiltersDto } from './dto/user-filters.dto';
import {
  VerifyEmailDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/auth-validation.dto';
import { EmailService } from '../../common/email/email.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { UserOwnershipGuard } from '../../common/guards/user-ownership.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPERVISOR, UserRole.USER_ROL_COLLABORATOR)
  async findAll(@Query() filters: UserFiltersDto, @Req() request: any) {
    const requester = request.user;

    // Los no-super-admins tienen filtros forzados
    if (requester.role_id !== UserRole.USER_ROL_SUPER_ADMIN) {
      // Admins/Supervisors ven su organización
      if (requester.organization_id) {
        filters.organization_id = requester.organization_id;
      } else {
        // Collaborators o Admins sin org solo se ven a sí mismos
        filters.id = requester.id;
      }
    }

    const result = await this.usersService.findAll(filters);
    return {
      data: result.users || [],
      total: result.total || 0,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  @Get(':id')
  @UseGuards(UserOwnershipGuard)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.searchUserByCondition({ id, deleted: false }, undefined, [
      'id',
      'name',
      'email',
      'document',
      'role_id',
      'phone',
      'phone_additional',
      'phone_whatsapp',
      'is_verified',
      'organization_id',
      'created_at',
      'updated_at',
      'branches',
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN)
  create(@Body() createUserDto: CreateUserDto, @Req() req: any) {
    const requester = req.user;

    // Si un admin crea un usuario, lo asigna a su propia organización
    if (requester.role_id === UserRole.USER_ROL_ADMIN && requester.organization_id) {
      if (createUserDto.organizationId && createUserDto.organizationId !== requester.organization_id) {
        throw new ForbiddenException('No puedes asignar un usuario a una organización diferente a la tuya.');
      }
      createUserDto.organizationId = requester.organization_id;
    }
    
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  @UseGuards(UserOwnershipGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any
  ) {
    const requester = req.user;

    // Evitar que un admin se cambie de organización o rol a superadmin
    if (requester.role_id === UserRole.USER_ROL_ADMIN) {
      if (updateUserDto.organizationId && updateUserDto.organizationId !== requester.organization_id) {
        throw new ForbiddenException('No puedes cambiar la organización de este usuario.');
      }
      if (updateUserDto.role_id === UserRole.USER_ROL_SUPER_ADMIN) {
        throw new ForbiddenException('No puedes ascender a un usuario a Super Admin.');
      }
    }
    
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(UserOwnershipGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN)
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const requester = req.user;

    if (requester.role_id === UserRole.USER_ROL_ADMIN) {
      if (requester.id === id) {
        throw new ForbiddenException('Un administrador no puede eliminarse a sí mismo.');
      }
    }

    await this.usersService.remove(id);
    return { success: true, message: 'Usuario eliminado correctamente.' };
  }

  // ===========================================================================
  // Endpoints públicos o con lógica de autorización propia
  // ===========================================================================

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.usersService.verifyEmail(verifyEmailDto.token);
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() requestPasswordResetDto: RequestPasswordResetDto) {
    const result = await this.usersService.requestPasswordReset(
      requestPasswordResetDto.email,
    );

    if (result.success && result.user && result.token) {
      try {
        await this.emailService.sendPasswordResetEmail(
          result.user.email,
          result.user.name,
          result.token,
        );
      } catch (emailError) {
        console.error('Error sending password reset email:', emailError);
      }
    }

    return {
      success: true,
      message:
        'Si el email existe en nuestro sistema, recibirás un enlace de recuperación',
    };
  }

  @Get('validate-reset-token/:token')
  @HttpCode(HttpStatus.OK)
  async validateResetToken(@Param('token') token: string) {
    return this.usersService.validateResetToken(token);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.usersService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body()
    body: {
      id: number;
      oldPassword: string;
      newPassword: string;
    },
  ) {
    return this.usersService.changePassword(
      body.id,
      body.oldPassword,
      body.newPassword,
    );
  }

  @Post('change-email')
  @HttpCode(HttpStatus.OK)
  async changeEmail(
    @Req() req: any,
    @Body()
    body: {
      oldEmail: string;
      newEmail: string;
    },
  ) {
    // El guard ya protege esta ruta, req.user existe.
    if (req.user.email !== body.oldEmail) {
      throw new ForbiddenException('El email actual no coincide con tu cuenta.');
    }

    const result = await this.usersService.changeEmail(req.user.id, body.newEmail);

    if (result.success && result.newEmail && result.name) {
      try {
        await this.emailService.sendEmailChangedEmail(result.newEmail, result.name);
      } catch (emailError) {
        console.error('Error sending email changed notification:', emailError);
      }
    }

    return { success: result.success, message: result.message };
  }

  @Post('update-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN)
  async updatePassword(
    @Req() req: any,
    @Body()
    body: {
      user_id: number;
      newPassword: string;
    },
  ) {
    const requester = req.user;
    const targetUserId = body.user_id;

    if (requester.role_id === UserRole.USER_ROL_ADMIN) {
      if (!requester.organization_id) {
        throw new ForbiddenException('No tienes permisos para esta acción.');
      }
      const targetUser = await this.usersService.findById(targetUserId);
      if (!targetUser || targetUser.organization_id !== requester.organization_id) {
        throw new ForbiddenException('No puedes cambiar la contraseña de este usuario.');
      }
    }
    
    return this.usersService.updatePassword(targetUserId, body.newPassword, requester.id);
  }

  @Post('close-account')
  @HttpCode(HttpStatus.OK)
  async closeAccount(
    @Body()
    body: {
      id: number;
      password: string;
    },
  ) {
    const user = await this.usersService.searchUserByCondition(
      { id: body.id, deleted: false },
      body.password,
    );

    if (user) {
      await this.usersService.remove(body.id);
      return {
        success: true,
        message: 'Cuenta eliminada exitosamente',
      };
    } else {
      return {
        success: false,
        message: 'Contraseña incorrecta. No se pudo eliminar la cuenta.',
      };
    }
  }
}
