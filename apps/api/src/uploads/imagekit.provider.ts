import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import ImageKit from '@imagekit/nodejs';
import { ImageStorageProvider } from './image-storage.provider';
import { RuntimeConfig } from '../config/runtime-config';

@Injectable()
export class ImageKitProvider extends ImageStorageProvider {
  constructor(private readonly config: RuntimeConfig) {
    super();
  }
  private get client() {
    const key = this.config.values.IMAGEKIT_PRIVATE_KEY;
    if (!key) throw new ServiceUnavailableException();
    return new ImageKit({ privateKey: key, maxRetries: 1, timeout: 20000 });
  }

  authentication(token: string, expire: number) {
    const {
      IMAGEKIT_PUBLIC_KEY: publicKey,
      IMAGEKIT_URL_ENDPOINT: urlEndpoint,
    } = this.config.values;
    if (!publicKey || !urlEndpoint) throw new ServiceUnavailableException();
    return {
      ...this.client.helper.getAuthenticationParameters(token, expire),
      publicKey,
      urlEndpoint,
    };
  }

  async get(fileId: string) {
    const file = await this.client.files.get(fileId);
    if (!file.filePath || !file.url || !file.fileId)
      throw new Error('Invalid storage response');
    return {
      fileId: file.fileId,
      filePath: file.filePath,
      url: file.url,
      isPrivate: file.isPrivateFile === true,
      fileType: file.fileType ?? '',
      size: file.size ?? 0,
    };
  }

  url(
    filePath: string,
    width: number,
    format: 'jpg' | 'png' = 'jpg',
    expiresIn = 900,
  ) {
    if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 900)
      throw new Error('Invalid signed image expiry');
    const urlEndpoint = this.config.values.IMAGEKIT_URL_ENDPOINT;
    if (!urlEndpoint) throw new ServiceUnavailableException();
    return this.client.helper.buildSrc({
      urlEndpoint,
      src: filePath,
      transformation: [{ width, format }],
      signed: true,
      expiresIn,
    });
  }

  async delete(fileId: string) {
    try {
      await this.client.files.delete(fileId);
    } catch (error) {
      if (!(error instanceof ImageKit.APIError) || error.status !== 404)
        throw new Error('Image deletion failed');
    }
  }
  async listUserFiles(userId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(userId))
      throw new Error('Invalid user folder');
    const prefix = `/stylist/${userId}/`;
    const files = await this.client.assets.list({
      searchQuery: `path : "${prefix}" AND type = "file"`,
      limit: 100,
    });
    return files.map((file) => {
      if (
        !('fileId' in file) ||
        !file.fileId ||
        !file.filePath?.startsWith(prefix)
      )
        throw new Error('Invalid storage inventory');
      return file.fileId;
    });
  }

  async saveResult(image: Buffer, userId: string, jobId: string) {
    const file = await this.client.files.upload({
      file: image.toString('base64'),
      fileName: `${jobId}.png`,
      folder: `/stylist/${userId}/results`,
      isPrivateFile: true,
      useUniqueFileName: false,
      overwriteFile: false,
      responseFields: ['isPrivateFile'],
    });
    if (!file.fileId || !file.filePath || file.isPrivateFile !== true)
      throw new Error('Invalid result upload');
    return { fileId: file.fileId, filePath: file.filePath };
  }
}
