// Explicit paid provider smoke: at most TWO image calls, synthetic references only.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { loadEnvFile } = require('node:process');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
loadEnvFile('.env');
const { RuntimeConfig } = require('../dist/config/runtime-config');
const {
  OpenAiAssetProvider,
} = require('../dist/garment-assets/openai-asset.provider');
const { AssetImage } = require('../dist/garment-assets/asset-image');
const { ImageKitProvider } = require('../dist/uploads/imagekit.provider');
let stage = 'configuration';
(async () => {
  const config = new RuntimeConfig(),
    provider = new OpenAiAssetProvider(config),
    image = new AssetImage(),
    storage = new ImageKitProvider(config),
    userId = randomUUID(),
    files = [];
  const output = '.artifacts/mannequin-smoke';
  mkdirSync(output, { recursive: true });
  const report = {
    model: provider.model,
    promptVersion: 'asset-v1',
    imageCalls: 0,
    cases: [],
  };
  try {
    stage = 'idea proposal';
    const proposal = await provider.plan({
      menu: 'jewelry',
      type: 'ring',
      prompt: 'nhẫn bạc tối giản có một viên đá nhỏ',
      bodyKey: 'f',
    });
    assert.equal(proposal.length, 1);
    assert.equal(proposal[0].type, 'ring');
    stage = 'private reference upload';
    const source = await storage.saveResult(
      readFileSync('../../packages/shared/assets/wardrobe/white-shirt.png'),
      userId,
      randomUUID(),
    );
    files.push(source.fileId);
    const referenceUrl = storage.url(source.filePath, 1024);
    stage = 'photo suitability';
    await provider.checkPhoto(referenceUrl, 'shirt');
    const cases = [
      {
        id: 'photo-shirt',
        type: 'shirt',
        bodyKey: 'm',
        prompt: 'Giữ đúng sơ mi trắng trong ảnh tham chiếu, chỉ lấy áo.',
        referenceUrl,
      },
      {
        id: 'idea-ring',
        type: 'ring',
        bodyKey: 'f',
        prompt: proposal[0].prompt,
      },
    ];
    for (const input of cases) {
      stage = `generate ${input.id}`;
      assert.ok(report.imageCalls < 2);
      report.imageCalls++;
      const started = Date.now();
      const result = await image.normalize(
        await provider.generate(input),
        input.type,
      );
      writeFileSync(`${output}/${input.id}.png`, result.image);
      stage = `private signed PNG ${input.id}`;
      const file = await storage.saveResult(result.image, userId, randomUUID());
      files.push(file.fileId);
      assert.equal((await storage.get(file.fileId)).isPrivate, true);
      const signed = await fetch(storage.url(file.filePath, 400, 'png'));
      assert.equal(signed.status, 200);
      const sharp = require('sharp');
      const decoded = await sharp(Buffer.from(await signed.arrayBuffer()))
        .ensureAlpha()
        .raw()
        .toBuffer();
      assert.equal(decoded[3], 0);
      report.cases.push({
        id: input.id,
        type: input.type,
        ...result.meta,
        milliseconds: Date.now() - started,
      });
      console.log(
        `Provider case passed: ${input.id}, transparent PNG, signed private preview.`,
      );
    }
    writeFileSync(
      `${output}/report.json`,
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(
      'Provider smoke passed: 2 image calls maximum; synthetic outputs saved locally; remote fixtures cleaned.',
    );
  } finally {
    for (const id of files) await storage.delete(id);
  }
})().catch(() => {
  console.error(
    `Provider smoke failed at ${stage}; credentials and private URLs are not logged.`,
  );
  process.exitCode = 1;
});
