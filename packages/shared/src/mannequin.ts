import { z } from 'zod';
import { ErrorCode } from './errors';
import { GarmentType, isTryOnAllowed } from './wardrobe';

import { BodyKey, AssetStatus, MannequinAsset } from './mannequin-asset';
export * from './mannequin-asset';
export const GenerationType = z.enum(GarmentType.options.filter(isTryOnAllowed) as [GarmentType, ...GarmentType[]]);
export const GENERATION_MENUS = [
  {id:'outfit',label:'Bộ',types:[]},
  {id:'top',label:'Áo',types:['shirt','t_shirt','blouse','polo','tank_top','sweater','hoodie','blazer','jacket','coat','cardigan','vest']},
  {id:'pants',label:'Quần',types:['trousers','jeans','shorts','wide_leg','leggings']},
  {id:'dress',label:'Đầm / Váy',types:['mini_skirt','midi_skirt','maxi_skirt','mini_dress','midi_dress','maxi_dress','jumpsuit','romper','ao_dai','kimono']},
  {id:'shoes',label:'Giày',types:['sneakers','boots','sandals','heels','loafers']},
  {id:'bag',label:'Túi',types:['crossbody','tote','backpack','clutch']},
  {id:'hat',label:'Nón',types:['fedora','cap','beanie']},
  {id:'accessory',label:'Phụ kiện',types:['glasses','sunglasses','scarf','tie','belt','watch']},
  {id:'jewelry',label:'Trang sức',types:['necklace','earrings','bracelet','ring']},
] as const;
export const GenerationMenu = z.enum(['outfit','top','pants','dress','shoes','bag','hat','accessory','jewelry']);
export const IdeaRequest = z.strictObject({menu:GenerationMenu,type:GenerationType.optional(),prompt:z.string().trim().min(1).max(1000),bodyKey:BodyKey}).superRefine((input,ctx)=>{
  const menu=GENERATION_MENUS.find(m=>m.id===input.menu)!;
  if(input.menu==='outfit' ? input.type!==undefined : !input.type || !(menu.types as readonly string[]).includes(input.type))
    ctx.addIssue({code:'custom',path:['type'],message:'Select a type from the requested menu'});
});
export const IdeaProposal = z.strictObject({label:z.string().min(1).max(100),type:GenerationType,prompt:z.string().min(1).max(1000)});
export const IdeaProposals = z.strictObject({items:z.array(IdeaProposal).min(1).max(4)});
export const AssetInput = z.discriminatedUnion('source',[
  z.strictObject({source:z.literal('photo'),garmentId:z.uuid(),bodyKey:BodyKey}),
  z.strictObject({source:z.literal('idea'),type:GenerationType,prompt:z.string().trim().min(1).max(1000),bodyKey:BodyKey}),
]);
export const CreateAssetJobsRequest = z.strictObject({items:z.array(AssetInput).min(1).max(4)}).superRefine((request,ctx)=>{
  const ids=request.items.filter(i=>i.source==='photo').map(i=>`${i.garmentId}:${i.bodyKey}`);
  if(new Set(ids).size!==ids.length) ctx.addIssue({code:'custom',path:['items'],message:'Duplicate photo variant'});
});
export const CreateAssetJobsResponse = z.strictObject({jobIds:z.array(z.uuid()).min(1).max(4)});
export const CreateIdeaResponse = z.strictObject({jobId:z.uuid()});
export const AssetJobResponse = z.strictObject({id:z.uuid(),status:AssetStatus,source:z.enum(['photo','idea']),bodyKey:BodyKey,errorCode:ErrorCode.nullable(),garmentId:z.uuid().nullable(),asset:MannequinAsset.nullable(),createdAt:z.iso.datetime()});
export const IdeaJobResponse = z.strictObject({id:z.uuid(),status:AssetStatus,errorCode:ErrorCode.nullable(),items:z.array(IdeaProposal).max(4),bodyKey:BodyKey,createdAt:z.iso.datetime()});
export const AssetQuotaResponse = z.strictObject({enabled:z.boolean(),limit:z.literal(5),remaining:z.number().int().min(0).max(5),ideaPlansRemaining:z.number().int().min(0).max(10),resetAt:z.iso.datetime()});
export type AssetInput=z.infer<typeof AssetInput>;
export type IdeaRequest=z.infer<typeof IdeaRequest>;
export type IdeaProposal=z.infer<typeof IdeaProposal>;
