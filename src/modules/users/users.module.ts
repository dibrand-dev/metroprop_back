import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { S3Service } from '../../common/s3.service';
import { ImageUploadModule } from '../../common/image-upload/image-upload.module';
import { EmailModule } from '../../common/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), 
    ImageUploadModule,
    EmailModule
  ],
  providers: [UsersService, S3Service],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
