import { Module } from '@nestjs/common';
import { ImageStorageProvider } from './image-storage.provider';
import { ImageKitProvider } from './imagekit.provider';
@Module({
  providers: [{ provide: ImageStorageProvider, useClass: ImageKitProvider }],
  exports: [ImageStorageProvider],
})
export class ImageStorageModule {}
