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
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  async findAll(@Query() filters: UserFiltersDto) {
    const result = await this.usersService.findAll(filters);
    return {
      data: result.users,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
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
