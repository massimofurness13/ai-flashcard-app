import { z } from "zod";
const id=z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/);
const text=z.string().trim().min(1).max(5000);
export const cardFields=z.object({front:text,back:text,hint:z.string().max(1000).nullable().optional(),tags:z.string().max(500).nullable().optional(),imageUrl:z.string().url().max(2000).nullable().optional(),imageTier:z.enum(["quick","premium"]).nullable().optional()}).strict();
export const deckFields=z.object({name:z.string().trim().min(1).max(200),description:z.string().max(1000).nullable().optional(),emoji:z.string().max(20).nullable().optional(),folderId:id.nullable().optional(),frontVoice:z.string().max(200).nullable().optional(),backVoice:z.string().max(200).nullable().optional(),frontLanguageCode:z.string().max(50).nullable().optional(),backLanguageCode:z.string().max(50).nullable().optional()}).strict();
const createdCards=z.array(cardFields.extend({id})).min(1).max(500);
const base=z.record(z.string(),z.union([z.string(),z.number(),z.boolean(),z.null()]));
export const offlineMutationSchema=z.object({eventId:z.string().uuid(),operation:z.discriminatedUnion("kind",[
 z.object({kind:z.literal("cards:create"),deckId:id,cards:createdCards}).strict(),
 z.object({kind:z.literal("card:create"),id:id,deckId:id,fields:cardFields}).strict(),
 z.object({kind:z.literal("card:update"),id:id,fields:cardFields.partial(),base}).strict(),
 z.object({kind:z.literal("card:delete"),id:id,base}).strict(),
 z.object({kind:z.literal("deck:create"),id:id,fields:deckFields,cards:createdCards.optional()}).strict(),
 z.object({kind:z.literal("deck:update"),id:id,fields:deckFields.partial().extend({archive:z.boolean().optional()}),base}).strict(),
 z.object({kind:z.literal("deck:delete"),id:id,base}).strict(),
 z.object({kind:z.literal("folder:create"),id:id,fields:z.object({name:z.string().trim().min(1).max(200),emoji:z.string().max(20).nullable().optional()}).strict()}).strict(),
 z.object({kind:z.literal("user:goal"),dailyGoal:z.number().int().min(1).max(500)}).strict(),
])}).strict();
export type OfflineMutation=z.infer<typeof offlineMutationSchema>;
export function changedElsewhere(current:Record<string,unknown>,base:Record<string,unknown>){return Object.entries(base).some(([key,value])=>(current[key]??null)!==value);}
