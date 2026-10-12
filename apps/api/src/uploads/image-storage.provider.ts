export interface StoredImage {
  fileId: string;
  filePath: string;
  url: string;
  isPrivate: boolean;
  fileType: string;
  size: number;
}

export abstract class ImageStorageProvider {
  abstract authentication(
    token: string,
    expire: number,
  ): {
    token: string;
    expire: number;
    signature: string;
    publicKey: string;
    urlEndpoint: string;
  };
  abstract get(fileId: string): Promise<StoredImage>;
  abstract url(filePath: string, width: number): string;
  abstract delete(fileId: string): Promise<void>;
}
