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

  url(filePath: string, width: number) {
    const urlEndpoint = this.config.values.IMAGEKIT_URL_ENDPOINT;
    if (!urlEndpoint) throw new ServiceUnavailableException();
    return this.client.helper.buildSrc({
      urlEndpoint,
      src: filePath,
      transformation: [{ width, format: 'jpg' }],
      signed: true,
      expiresIn: 900,
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
}
