import ImageKit from '@imagekit/nodejs';
import { randomUUID } from 'node:crypto';
import { ImageKitProvider } from './imagekit.provider';
import { RuntimeConfig } from '../config/runtime-config';

jest.mock('@imagekit/nodejs', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const list = jest.fn();
const userId = randomUUID();
const prefix = `/stylist/${userId}/`;
const storage = new ImageKitProvider({
  values: { IMAGEKIT_PRIVATE_KEY: 'fixture' },
} as RuntimeConfig);

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(ImageKit)
    .mockImplementation(() => ({ assets: { list } }) as unknown as ImageKit);
});

it('inventories nested orphan files using the ImageKit prefix operator and excludes folders', async () => {
  list.mockResolvedValue([
    { fileId: 'upload', filePath: `${prefix}uploads/grant/photo.png` },
    { fileId: 'orphan', filePath: `${prefix}results/orphan.png` },
  ]);
  await expect(storage.listUserFiles(userId)).resolves.toEqual([
    'upload',
    'orphan',
  ]);
  expect(list).toHaveBeenCalledWith({
    searchQuery: `path : "${prefix}" AND type = "file"`,
    limit: 100,
  });
});

it.each([
  { fileId: 'foreign', filePath: `/stylist/${randomUUID()}/results/photo.png` },
  { fileId: 'sibling', filePath: `/stylist/${userId}-other/photo.png` },
  { folderId: 'folder', filePath: `${prefix}results` },
  { fileId: 'missing-path' },
])(
  'refuses an inventory entry that cannot be safely deleted: %j',
  async (file) => {
    list.mockResolvedValue([file]);
    await expect(storage.listUserFiles(userId)).rejects.toThrow(
      'Invalid storage inventory',
    );
  },
);

it('rejects an invalid user folder before sending an inventory request', async () => {
  await expect(storage.listUserFiles('../other')).rejects.toThrow(
    'Invalid user folder',
  );
  expect(list).not.toHaveBeenCalled();
});

it('keeps legacy image expiry and bounds short-lived share URLs', () => {
  const buildSrc = jest.fn().mockReturnValue('https://images.example/signed');
  jest
    .mocked(ImageKit)
    .mockImplementation(
      () => ({ helper: { buildSrc } }) as unknown as ImageKit,
    );
  const provider = new ImageKitProvider({
    values: {
      IMAGEKIT_PRIVATE_KEY: 'fixture',
      IMAGEKIT_URL_ENDPOINT: 'https://images.example',
    },
  } as RuntimeConfig);
  provider.url('/private/file', 400);
  expect(buildSrc).toHaveBeenLastCalledWith(
    expect.objectContaining({ expiresIn: 900 }),
  );
  provider.url('/private/file', 400, 'jpg', 30);
  expect(buildSrc).toHaveBeenLastCalledWith(
    expect.objectContaining({ expiresIn: 30 }),
  );
  expect(() => provider.url('/private/file', 400, 'jpg', 901)).toThrow(
    'Invalid signed image expiry',
  );
  expect(() => provider.url('/private/file', 400, 'jpg', 0)).toThrow(
    'Invalid signed image expiry',
  );
});
