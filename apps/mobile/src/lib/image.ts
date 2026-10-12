import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type LocalImage = { uri: string; width: number; height: number };

/** Long edge sent to ImageKit: enough for try-on, far smaller than a 12MP camera photo. */
const MAX_EDGE = 1600;

/** Resize to MAX_EDGE on the long side and re-encode as JPEG before upload. */
export async function prepareForUpload(image: LocalImage): Promise<LocalImage> {
  const context = ImageManipulator.manipulate(image.uri);
  if (Math.max(image.width, image.height) > MAX_EDGE) {
    context.resize(image.width >= image.height ? { width: MAX_EDGE, height: null } : { width: null, height: MAX_EDGE });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

export type PickResult = { images: LocalImage[] } | { denied: true };

/** Camera asks permission at the moment it is needed; the system photo picker needs none. */
export async function pickImages({ camera, multiple }: { camera?: boolean; multiple?: boolean }): Promise<PickResult> {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { denied: true };
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1, allowsMultipleSelection: !!multiple && !camera, selectionLimit: multiple ? 10 : 1 };
  const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return { images: [] };
  return { images: result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height })) };
}
