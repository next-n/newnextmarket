import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, UploadType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async uploadImage(file: any, type: UploadType, adminId?: string, relations: { productId?: string; bannerId?: string } = {}) {
    if (!file) throw new BadRequestException('Image file is required');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid image type');
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException('Image file is too large');
    }
    const extension = extname(file.originalname) || this.extensionForMime(file.mimetype);
    const filename = `${randomUUID()}${extension}`;
    const storage = this.storageConfig();
    const key = `${this.folderFor(type)}/${relations.productId ?? 'unassigned'}/${filename}`;
    let url: string;

    if (storage) {
      const { PutObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        forcePathStyle: true,
        region: storage.region,
        endpoint: storage.endpoint,
        credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
      });
      await client.send(new PutObjectCommand({ Bucket: storage.bucket, Key: key, Body: file.buffer, ContentType: file.mimetype, CacheControl: 'public,max-age=31536000,immutable' }));
      url = `${storage.publicBaseUrl}/${key}`;
    } else {
      const uploadDir = join(process.cwd(), 'uploads');
      await mkdir(uploadDir, { recursive: true });
      await writeFile(join(uploadDir, filename), file.buffer);
      url = `/uploads/${filename}`;
    }

    const upload = await this.prisma.upload.create({
      data: {
        type,
        url,
        filename: key,
        mimeType: file.mimetype,
        size: file.size,
        adminId,
        productId: relations.productId,
        bannerId: relations.bannerId,
        metadata: { originalName: file.originalname } as any,
      },
    });
    return this.toUploadResponse(upload);
  }

  async list() {
    const uploads = await this.prisma.upload.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return uploads.map((upload) => this.toUploadResponse(upload));
  }

  async delete(id: string, adminId?: string) {
    const existing = await this.prisma.upload.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Upload not found');
    const storage = this.storageConfig();
    if (storage && existing.filename.includes('/')) {
      const { DeleteObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
      const client = new S3Client({ forcePathStyle: true, region: storage.region, endpoint: storage.endpoint, credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey } });
      await client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: existing.filename }));
    }
    const upload = await this.prisma.upload.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.auditLogs.log({
      adminId,
      action: AuditAction.DELETE,
      entityType: 'Upload',
      entityId: id,
      metadata: { url: upload.url },
    });
    return this.toUploadResponse(upload);
  }

  private extensionForMime(mimeType: string) {
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/webp') return '.webp';
    return '.jpg';
  }

  private folderFor(type: UploadType) {
    if (type === UploadType.PRODUCT_IMAGE) return 'products';
    if (type === UploadType.BANNER_IMAGE) return 'banners';
    return 'general';
  }

  private storageConfig() {
    const endpoint = this.config?.get<string>('SUPABASE_STORAGE_ENDPOINT');
    const bucket = this.config?.get<string>('SUPABASE_STORAGE_BUCKET');
    const region = this.config?.get<string>('SUPABASE_STORAGE_REGION');
    const accessKeyId = this.config?.get<string>('SUPABASE_S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config?.get<string>('SUPABASE_S3_SECRET_ACCESS_KEY');
    if (!endpoint || !bucket || !region || !accessKeyId || !secretAccessKey) return null;
    const publicBaseUrl = endpoint.replace('.storage.supabase.co/storage/v1/s3', '.supabase.co/storage/v1/object/public') + `/${bucket}`;
    return { endpoint, bucket, region, accessKeyId, secretAccessKey, publicBaseUrl };
  }

  private toUploadResponse(upload: any) {
    return {
      id: upload.id,
      type: upload.type,
      url: upload.url,
      filename: upload.filename,
      mimeType: upload.mimeType,
      size: upload.size,
      altText: upload.altText,
      metadata: upload.metadata,
      productId: upload.productId,
      bannerId: upload.bannerId,
      adminId: upload.adminId,
      createdAt: upload.createdAt,
      updatedAt: upload.updatedAt,
    };
  }
}
