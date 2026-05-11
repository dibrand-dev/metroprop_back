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
  NotFoundException
} from '@nestjs/common';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFiltersDto } from './dto/user-filters.dto';
import { VerifyEmailDto, RequestPasswordResetDto, ResetPasswordDto } from './dto/auth-validation.dto';
import { EmailService } from '../../common/email/email.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN)
  async findAll(@Query() filters: UserFiltersDto, @Req() request: Request) {
    if ((request as any).user.role_id === UserRole.USER_ROL_ADMIN) {
      if((request as any).user.organization_id !== undefined) {
        filters.organization_id = (request as any).user.organization_id;
      } else {
        filters.id = (request as any).user.id;
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SELLER)
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() request: any) {
    const requester = (request as any).user;
    const where: any = { id, deleted: false };
    if( requester.role_id !== UserRole.USER_ROL_SUPER_ADMIN) {

      if (requester.role_id === UserRole.USER_ROL_ADMIN && requester.organization_id !== undefined) {
        where.organization_id = requester.organization_id;
      } else if (id !== requester.id) {
          // Si no tiene organization, solo puede acceder a su propio usuario
          throw new NotFoundException('User not found');
      }
    }

    const user = await this.usersService.searchUserByCondition(where, undefined, [
      'id',
      'name',
      'email',
      'document',
      'role_id',
      'is_verified',
      'organization_id',
      'created_at',
      'updated_at',
      'branches'
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN)
  update( 
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN)
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const requester = req.user;

    if (requester.role_id === UserRole.USER_ROL_ADMIN) {
      // Admin no puede eliminarse a sí mismo
      if (requester.id === id) {
        return { success: false, message: 'No se puede eliminar al admin de la organización' };
      }

      // Admin solo puede eliminar usuarios de su misma organización
      const target = await this.usersService.findById(id);
      if (target.organization?.id !== requester.organization_id) {
        return { success: false, message: 'No tenés permisos para eliminar este usuario' };
      }
    }

    await this.usersService.remove(id);
    return { success: true };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.usersService.verifyEmail(verifyEmailDto.token);
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() requestPasswordResetDto: RequestPasswordResetDto) {
    const result = await this.usersService.requestPasswordReset(requestPasswordResetDto.email);
    
    // Si hay usuario y token, enviar email
    if (result.success && result.user && result.token) {
      try {
        await this.emailService.sendPasswordResetEmail(result.user.email, result.user.name, result.token);
      } catch (emailError) {
        console.error('Error sending password reset email:', emailError);
      }
    }
    
    // Siempre devolver la misma respuesta por seguridad
    return {
      success: true,
      message: 'Si el email existe en nuestro sistema, recibirás un enlace de recuperación'
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
    return this.usersService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
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
    return this.usersService.changePassword(body.id, body.oldPassword, body.newPassword);
  }

  @Post('change-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async changeEmail(
    @Req() req: Request,
    @Body()
    body: {
      oldEmail: string;
      newEmail: string;
    },
  ) {
    if ((req as any).user.user.email !== body.oldEmail) {
      return { success: false, message: 'El email actual no coincide con tu cuenta' };
    }

    const result = await this.usersService.changeEmail((req as any).user.id, body.newEmail);

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN)
  async updatePassword(
    @Req() req: any,
    @Body()
    body: {
      user_id: number;
      newPassword: string;
    },
  ) {
    return this.usersService.updatePassword(body.user_id, body.newPassword, req.user.id);
  }

  // Que accion tomar cuando se cierra una cuenta ? Que pasa si viene info de tokko ?
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
        message: 'Cuenta eliminada exitosamente'
      };
    } else {
      return {
        success: false,
        message: 'Contraseña incorrecta. No se pudo eliminar la cuenta.'
      };
    }
  }
}
