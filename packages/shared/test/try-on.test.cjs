const assert = require('node:assert/strict');
const {test} = require('node:test');
const {CreateTryOnRequest, IdempotencyKey, TryOnJobResponse} = require('../dist');
const {randomUUID} = require('node:crypto');
test('try-on requests require one to four distinct garments and bounded occasion', () => {
  const input={modelPhotoId:randomUUID(),garmentIds:[randomUUID()],occasion:'  đi làm  '};
  assert.equal(CreateTryOnRequest.parse(input).occasion,'đi làm');
  for(const garmentIds of [[],Array(5).fill(randomUUID()),[...input.garmentIds,...input.garmentIds]]) assert.equal(CreateTryOnRequest.safeParse({...input,garmentIds}).success,false);
  assert.equal(CreateTryOnRequest.safeParse({...input,userId:randomUUID()}).success,false);
  assert.equal(CreateTryOnRequest.safeParse({...input,occasion:'x'.repeat(121)}).success,false);
});
test('idempotency keys cannot be empty or contain header control characters', () => {
  assert.equal(IdempotencyKey.safeParse(randomUUID()).success,true);
  for(const key of [undefined,'tiny','x'.repeat(129),'12345678\r\nsecret']) assert.equal(IdempotencyKey.safeParse(key).success,false);
});
test('job response exposes terminal state and explicit mock provider without private metadata', () => {
  const result={id:randomUUID(),status:'done',resultUrl:'https://images.example.com/signed',errorCode:null,outfitId:randomUUID(),provider:'fake',createdAt:new Date().toISOString()};
  assert.deepEqual(TryOnJobResponse.parse(result),result);
  assert.equal(TryOnJobResponse.safeParse({...result,filePath:'/private'}).success,false);
});
