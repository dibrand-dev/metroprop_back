import { Repository } from 'typeorm';

export interface ImageUploadConfig<T> {
  repository: any;
  entityId: number;
  imageFieldName: string;
  statusFieldName: string;
  s3Folder: string;
  primaryKeyField?: string;
}
