import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete, 
  Param, 
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { VerifyEmailDto, RequestPasswordResetDto, ResetPasswordDto } from './dto/auth-validation.dto';
import { EmailService } from '../../common/email/email.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService
  ) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
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
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Chequear existencia del usuario antes de subir
    const user = await this.usersService.findById(id);
    if (!user) {
      return {
        statusCode: 404,
        message: `User with id ${id} not found. No upload performed.`
      };
    }

    // Upload a S3
    const imageUrl = await this.usersService.uploadAvatarToS3(file, id);

    // Actualizar el avatar del usuario en la DB solo si subió bien
    if (imageUrl) {
      await this.usersService.update(id, { avatar: imageUrl } as any);
    }

    return {
      message: imageUrl ? 'Avatar uploaded successfully' : 'Avatar upload failed',
      imageUrl: imageUrl,
      userId: id,
      fileSize: file.size,
      fileName: file.originalname,
      avatar_status: imageUrl ? null : 'Ver campo avatar_status en la entidad para detalles de error',
    };
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

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.usersService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
  }
}
