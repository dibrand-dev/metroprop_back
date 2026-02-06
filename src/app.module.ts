import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { BranchesModule } from './modules/branches/branches.module';
import { AuthModule } from './modules/auth/auth.module';
import { RegistrationModule } from './modules/registration/registration.module';
import { PropertiesModule } from './modules/properties/properties.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.prod' : '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Debug: mostrar valores que llegan desde el .env
        console.log('DB Config:', {
          host: configService.get<string>('DATABASE_HOST'),
          port: configService.get<number>('DATABASE_PORT'),
          database: configService.get<string>('DATABASE_NAME'),
          synchronize: configService.get<string>('DATABASE_SYNCHRONIZE'),
          logging: configService.get<string>('DATABASE_LOGGING'),
        });
    return {

        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get<string>('DATABASE_USER'),
        password: configService.get<string>('DATABASE_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        entities: [__dirname + '/modules/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/**/*{.ts,.js}'],
        synchronize: configService.get<boolean>('DATABASE_SYNCHRONIZE') ?? true,
        logging: configService.get<boolean>('DATABASE_LOGGING') ?? false,
        ssl:
          process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
      };
      },
    }),
    UsersModule,
    AuthModule,
    OrganizationsModule,
    BranchesModule,
    RegistrationModule,
    PropertiesModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
