import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ImageUploadModule } from '../../common/image-upload/image-upload.module';
import { EmailModule } from '../../common/email/email.module';
import { UserOwnershipGuard } from '../../common/guards/user-ownership.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    ImageUploadModule,
    EmailModule
  ],
  providers: [UsersService, UserOwnershipGuard],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
