import { S3Service } from '../../common/s3.service';
import { USER_IMAGE_FOLDER } from '../../common/constants';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Int32, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Organization } from '../organizations/entities/organization.entity';
import { Branch } from '../branches/entities/branch.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly s3Service: S3Service,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException(`Duplicate value for field 'email'. This value already exists in the database.`);
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
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

  async findAll(limit: number = 10, offset: number = 0) {
    const [users, total] = await this.usersRepository.findAndCount({
      skip: offset,
      take: limit,
      select: [
        'id',
        'name',
        'email',
        'role',
        'is_verified',
        'created_at',
        'updated_at',
      ],
    });

    return { users, total };
  }

  async findById(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
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
    const result = await this.usersRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Sube un avatar a S3 usando el key relativo (ej: 147/avatar.jpg)
   * El path final será users/147/avatar.jpg
   */
  async uploadAvatarToS3(file: Express.Multer.File, key: string): Promise<string> {
    const filenamePath = `${USER_IMAGE_FOLDER}/${key}`;
    return this.s3Service.uploadImage(file.buffer, filenamePath, file.mimetype);
  }
}
