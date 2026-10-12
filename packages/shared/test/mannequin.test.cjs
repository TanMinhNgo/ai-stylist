const assert=require('node:assert/strict');const {test}=require('node:test');const {randomUUID}=require('node:crypto');
const {IdeaRequest,GenerationType,GENERATION_MENUS,CreateAssetJobsRequest,CreateGarmentRequest,CreateModelPhotoRequest}=require('../dist');
test('menu and subtype agree, and restricted types cannot generate',()=>{
  assert.equal(GENERATION_MENUS.length,9);
  assert.equal(IdeaRequest.safeParse({menu:'jewelry',type:'ring',prompt:'nhẫn bạc',bodyKey:'f'}).success,true);
  for(const type of ['underwear','swimwear','sleepwear'])assert.equal(GenerationType.safeParse(type).success,false);
  for(const input of [{menu:'bag',type:'shirt'}, {menu:'outfit',type:'shirt'}, {menu:'top'}])assert.equal(IdeaRequest.safeParse({...input,prompt:'mẫu đẹp',bodyKey:'m'}).success,false);
});
test('batch input is bounded, scoped by IDs, and cannot duplicate a photo variant',()=>{
  const photo={source:'photo',garmentId:randomUUID(),bodyKey:'m'};
  assert.equal(CreateAssetJobsRequest.safeParse({items:[photo]}).success,true);
  for(const items of [[],[photo,photo],Array(5).fill({source:'idea',type:'shirt',prompt:'áo trắng',bodyKey:'f'})])assert.equal(CreateAssetJobsRequest.safeParse({items}).success,false);
  assert.equal(CreateAssetJobsRequest.safeParse({items:[{...photo,userId:randomUUID()}]}).success,false);
});
test('garment upload opts in explicitly; model photo contract stays separate',()=>{
  const input={imagekitFileId:'fixture',url:'https://images.example.com/source',uploadToken:randomUUID()};
  assert.equal(CreateGarmentRequest.parse(input).generateAsset,false);
  assert.equal(CreateGarmentRequest.safeParse({...input,generateAsset:true,bodyKey:'m',requestedType:'shirt'}).success,true);
  assert.equal(CreateModelPhotoRequest.safeParse({...input,generateAsset:true}).success,false);
});
