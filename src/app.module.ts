import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { S3Module } from './common/s3.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { BranchesModule } from './modules/branches/branches.module';
import { AuthModule } from './modules/auth/auth.module';
import { RegistrationModule } from './modules/registration/registration.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { PartnersModule } from './modules/partners/partners.module';
import { EmailModule } from './common/email/email.module';
import { LocationsModule } from './modules/locations/locations.module';
import { TagsModule } from './modules/tags/tags.module';
import { DevelopersModule } from './modules/developers/developers.module';
import { TokkoSyncModule } from './modules/cron-tasks/tokko-sync/tokko-sync.module';
import { UploadS3CronModule } from './modules/cron-tasks/upload-s3/upload-s3.module';



if (process.env.NODE_ENV === 'production') {
  // Mostrar el valor de NODE_ENV en consola antes de cualquier error
  // Esto se ejecuta apenas carga el módulo
  // eslint-disable-next-line no-console
  console.log('NODE_ENV en producción:', process.env.NODE_ENV);
}

@Module({
  imports: [
    S3Module,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.prod' : '.env',
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
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
    PropertiesModule,
    PartnersModule,
    EmailModule,
    LocationsModule,
    TagsModule,
    DevelopersModule,
    TokkoSyncModule,
    UploadS3CronModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
