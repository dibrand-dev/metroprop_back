import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmailWithOrganization(loginDto.email);

    if (!user || !user.password) {
      throw new UnauthorizedException('El correo o la contraseña ingresados son incorrectos');
    }

    const isPasswordValid = await this.usersService.validatePassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('El correo o la contraseña ingresados son incorrectos');
    }

    // Verificar que el usuario haya validado su email
    if (!user.is_verified) {
      throw new UnauthorizedException('Tu cuenta aun no fue verificada. Revisa tu bandeja de entrada o spam y seguí las instrucciones.');
    }

    const access_token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role_id: user.role_id,
    });

    // Excluir campos sensibles antes de devolver
    const { password, email_verification_token, password_reset_token, password_reset_token_expires, role_id, ...safeUser } = user;

    return {
      access_token,
      user: safeUser,
    };
  }

  async validateUser(payload: any) {
    return this.usersService.findById(payload.sub);
  }
}
