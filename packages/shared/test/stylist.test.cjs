const {test}=require('node:test');const assert=require('node:assert/strict');
const {UpdateStyleProfileRequest,OutfitFeedbackRequest,SuggestRequest,StylistAdvice,OutfitListQuery,SuggestOutput}=require('../dist');
test('style preferences are bounded and never accept ownership or a taste vector',()=>{
 const input={styles:['basic'],occasions:['đi làm'],budget:1000000,preferredColors:['navy'],avoidedColors:[]};
 assert.deepEqual(UpdateStyleProfileRequest.parse(input),input);
 for(const patch of [{userId:'foreign'},{tasteVector:[1]},{budget:-1},{styles:Array(13).fill('x')},{bodyShape:'invented'}])assert.equal(UpdateStyleProfileRequest.safeParse({...input,...patch}).success,false);
});
test('feedback is tri-state and liked filter does not coerce false to true',()=>{
 for(const liked of [true,false,null])assert.deepEqual(OutfitFeedbackRequest.parse({liked}),{liked});
 assert.equal(OutfitFeedbackRequest.safeParse({liked:'false'}).success,false);
 assert.equal(OutfitListQuery.parse({liked:'false'}).liked,false);
 assert.equal(OutfitListQuery.safeParse({limit:51}).success,false);
});
test('suggestions and advice cannot return arbitrary structured output',()=>{
 assert.equal(SuggestRequest.safeParse({occasion:' ',userId:'foreign'}).success,false);
 assert.equal(SuggestOutput.safeParse({outfits:[{garmentIds:['not-an-id'],reason:'x'}],message:null}).success,false);
 assert.equal(StylistAdvice.safeParse({summary:'nice',strengths:['colors'],adjustments:[],accessories:[],occasionFit:{score:6,reason:'x'}}).success,false);
});
