import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import {
  ModelPhoto,
  Garment,
  GarmentTags,
  UploadAuthResponse,
  isTryOnAllowed,
  type CreateMediaRequest,
  type MediaListQuery,
  type GarmentListQuery,
} from '@stylist/shared';
import { MediaRepository, MediaKind } from './media.repository';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
import type { StoredImage } from '../uploads/image-storage.provider';

@Injectable()
export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: ImageStorageProvider,
    @InjectQueue('analysis') private readonly queue: Queue,
  ) {}

  async uploadAuth(userId: string) {
    const token = randomUUID();
    const expire = Math.floor(Date.now() / 1000) + 600;
    const folder = `/stylist/${userId}/${token}`;
    const auth = this.storage.authentication(token, expire);
    await this.repository.createGrant(
      token,
      userId,
      folder,
      new Date(expire * 1000),
    );
    return UploadAuthResponse.parse({ ...auth, folder, isPrivateFile: true });
  }

  private response(
    kind: MediaKind,
    row: Awaited<ReturnType<MediaRepository['register']>>,
  ) {
    const base = {
      id: row.id,
      imagekitFileId: row.imagekitFileId,
      status: row.status,
      errorCode: row.errorCode,
      createdAt: row.createdAt.toISOString(),
      url: this.storage.url(row.filePath, 1600),
      thumbnailUrl: this.storage.url(row.filePath, 400),
    };
    if (kind === 'model-photo')
      return ModelPhoto.parse({
        ...base,
        analysis: 'analysis' in row ? row.analysis : null,
      });
    const tags = 'tags' in row && row.tags ? GarmentTags.parse(row.tags) : null;
    return Garment.parse({
      ...base,
      tags,
      tryOnAllowed: tags ? isTryOnAllowed(tags.type) : null,
    });
  }

  async create(kind: MediaKind, userId: string, input: CreateMediaRequest) {
    const grant = await this.repository.grant(input.uploadToken, userId);
    if (!grant) throw new NotFoundException();
    if (grant.usedAt || grant.expiresAt <= new Date())
      throw new BadRequestException({
        code: 'UPLOAD_EXPIRED',
        message: 'Upload authorization expired or already used',
      });
    let file: StoredImage;
    try {
      file = await this.storage.get(input.imagekitFileId);
    } catch {
      throw new BadRequestException({
        code: 'UPLOAD_INVALID',
        message: 'Uploaded image is unavailable',
      });
    }
    const suppliedUrl = new URL(input.url);
    const actualUrl = new URL(file.url);
    if (
      file.fileId !== input.imagekitFileId ||
      !file.filePath.startsWith(grant.folder + '/') ||
      !file.isPrivate ||
      file.fileType !== 'image' ||
      file.size <= 0 ||
      file.size > 10 * 1024 * 1024 ||
      suppliedUrl.origin !== actualUrl.origin ||
      suppliedUrl.pathname !== actualUrl.pathname
    ) {
      throw new BadRequestException({
        code: 'UPLOAD_INVALID',
        message: 'Image does not match this upload authorization',
      });
    }
    const row = await this.repository.register(
      kind,
      input.uploadToken,
      userId,
      file,
    );
    try {
      await this.queue.add(
        kind,
        { kind, userId, id: row.id },
        {
          jobId: `${kind}-${row.id}`,
          attempts: 2,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    } catch {
      await this.repository.fail(
        kind,
        userId,
        row.id,
        'MEDIA_PROCESSING_FAILED',
      );
      throw new ServiceUnavailableException();
    }
    return this.response(kind, row);
  }

  async get(kind: MediaKind, userId: string, id: string) {
    const row = await this.repository.find(kind, userId, id);
    if (!row) throw new NotFoundException();
    return this.response(kind, row);
  }
  async list(
    kind: MediaKind,
    userId: string,
    query: MediaListQuery | GarmentListQuery,
  ) {
    const rows = await this.repository.list(kind, userId, query);
    const hasNext = rows.length > query.limit;
    const page: Awaited<ReturnType<MediaRepository['register']>>[] = rows.slice(
      0,
      query.limit,
    );
    return {
      items: page.map((row) => this.response(kind, row)),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }
  async remove(kind: MediaKind, userId: string, id: string) {
    const row = await this.repository.find(kind, userId, id);
    if (!row) throw new NotFoundException();
    await this.storage.delete(row.imagekitFileId);
    await this.repository.remove(kind, userId, id);
    return { deleted: true as const };
  }
}
