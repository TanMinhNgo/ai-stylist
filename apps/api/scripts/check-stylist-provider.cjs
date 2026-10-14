// Paid smoke: 2 operations, maximum 4 text/vision calls including schema retries.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { loadEnvFile } = require('node:process');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
loadEnvFile('.env');
const OpenAI = require('openai').default;
const { RuntimeConfig } = require('../dist/config/runtime-config');
const {
  OpenAiStylistProvider,
} = require('../dist/stylist/openai-stylist.provider');
const { ImageKitProvider } = require('../dist/uploads/imagekit.provider');
const { validateSuggestions } = require('../dist/stylist/suggestions');
const {
  StyleProfile,
  StylistAdvice,
  SuggestOutput,
} = require('@stylist/shared');
let stage = 'setup';
(async () => {
  const config = new RuntimeConfig(),
    provider = new OpenAiStylistProvider(config),
    storage = new ImageKitProvider(config);
  let file;
  const report = {
    model: provider.model,
    promptVersion: 'stylist-v1',
    knowledgeVersion: 'knowledge-v1',
    calls: 0,
    usage: [],
    cases: [],
  };
  const original = OpenAI.Responses.prototype.parse;
  OpenAI.Responses.prototype.parse = async function (...args) {
    assert.ok(report.calls < 4);
    report.calls++;
    const response = await original.apply(this, args);
    if (response.usage) report.usage.push(response.usage);
    return response;
  };
  try {
    const catalog = JSON.parse(
      readFileSync(
        '../../packages/shared/assets/wardrobe/manifest.json',
        'utf8',
      ),
    ).items;
    const names = [
      'white-shirt',
      'navy-blazer',
      'navy-trousers',
      'black-loafers',
      'white-tee',
      'blue-jeans',
      'black-oversized-tee',
      'khaki-shorts',
      'white-sneakers',
    ];
    const garments = names.map((id) => ({
      id: randomUUID(),
      tags: catalog.find((i) => i.id === id).tags,
      source: 'user_photo',
    }));
    const profile = StyleProfile.parse({
      styles: ['basic', 'classic'],
      occasions: ['đi làm'],
      budget: null,
      preferredColors: ['navy', 'white'],
      avoidedColors: [],
      bodyShape: null,
      skinTone: null,
      updatedAt: null,
    });
    stage = 'synthetic reference upload';
    file = await storage.saveResult(
      readFileSync('../../packages/shared/assets/formalwear/navy-business.png'),
      randomUUID(),
      randomUUID(),
    );
    stage = 'advice';
    let started = Date.now();
    const advice = StylistAdvice.parse(
      await provider.advice(
        {
          occasion: 'đi làm',
          profile,
          garments: garments.slice(0, 4),
          liked: [],
        },
        storage.url(file.filePath, 1024, 'png'),
      ),
    );
    report.cases.push({
      kind: 'advice',
      milliseconds: Date.now() - started,
      result: advice,
    });
    stage = 'suggest';
    started = Date.now();
    const suggestion = validateSuggestions(
      SuggestOutput.parse(
        await provider.suggest({
          occasion: 'đi làm',
          profile,
          garments,
          liked: [],
        }),
      ),
      garments,
    );
    assert.equal(suggestion.outfits.length, 3);
    report.cases.push({
      kind: 'suggest',
      milliseconds: Date.now() - started,
      result: suggestion,
    });
    mkdirSync('.artifacts/stylist-smoke', { recursive: true });
    writeFileSync(
      '.artifacts/stylist-smoke/report.json',
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(
      'Stylist real-provider smoke passed: structured advice and 3 valid suggestions; ' +
        report.calls +
        ' text/vision calls. Synthetic private reference only.',
    );
  } finally {
    OpenAI.Responses.prototype.parse = original;
    if (file) await storage.delete(file.fileId);
  }
})().catch(() => {
  console.error(
    'Stylist provider check failed at ' +
      stage +
      '; no credentials or private URLs logged.',
  );
  process.exitCode = 1;
});
