import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { offlineMutationSchema,changedElsewhere } from "@/lib/offline-mutation-schema";
import type { Prisma } from "@/generated/prisma/client";
class MutationError extends Error {constructor(message:string,public status:number){super(message);}}
const jsonValue=(value:unknown):Prisma.InputJsonValue=>JSON.parse(JSON.stringify(value));
export async function POST(request:Request){
 const auth=await requireAuth();if(auth.error)return auth.error;
 const raw=await request.text();if(raw.length>6000000)return Response.json({error:"Edit is too large"},{status:413});
 let decoded:unknown;try{decoded=JSON.parse(raw);}catch{return Response.json({error:"Invalid edit"},{status:400});}
 const parsed=offlineMutationSchema.safeParse(decoded);if(!parsed.success)return Response.json({error:"Invalid edit",details:parsed.error.flatten()},{status:400});
 const {eventId,operation:op}=parsed.data,owner=auth.userId;
 const id=createHash("sha256").update(`${owner}:${eventId}`).digest("hex"),requestHash=createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
 try{
  const result=await prisma.$transaction(async tx=>{
   const receipt=await tx.deviceMutation.findUnique({where:{id}});
   if(receipt){if(receipt.requestHash!==requestHash)throw new MutationError("This edit identifier has already been used",409);return receipt.result;}
   let result:unknown;
   async function folder(folderId:string|null|undefined){if(folderId&&!await tx.folder.findFirst({where:{id:folderId,userId:owner}}))throw new MutationError("Folder not found",404);}
   if(op.kind.startsWith("card:")&&op.kind!=="card:create"){
    const change=op as Extract<typeof op,{kind:"card:update"|"card:delete"}>;
    const card=await tx.card.findUnique({where:{id:change.id},include:{deck:{select:{userId:true}}}});
    if(!card||card.deck.userId!==owner)throw new MutationError("Card not found",404);
    if(changedElsewhere(card,change.base))throw new MutationError("This card was changed on another device. Your local edit is retained.",409);
    result=change.kind==="card:delete"?(await tx.card.delete({where:{id:change.id}}),{id:change.id,deleted:true}):await tx.card.update({where:{id:change.id},data:change.fields});
   }else if(op.kind==="cards:create"){
    if(!await tx.deck.findFirst({where:{id:op.deckId,userId:owner}}))throw new MutationError("Pack not found",404);
    const position=await tx.card.aggregate({where:{deckId:op.deckId},_max:{position:true}});
    await tx.card.createMany({data:op.cards.map((card,i)=>({...card,deckId:op.deckId,position:(position._max.position??-1)+i+1}))});
    result=await tx.card.findMany({where:{id:{in:op.cards.map(c=>c.id)},deckId:op.deckId},orderBy:{position:"asc"}});
   }else if(op.kind==="card:create"){
    if(!await tx.deck.findFirst({where:{id:op.deckId,userId:owner}}))throw new MutationError("Pack not found",404);
    const position=await tx.card.aggregate({where:{deckId:op.deckId},_max:{position:true}});
    result=await tx.card.create({data:{id:op.id,deckId:op.deckId,...op.fields,position:(position._max.position??-1)+1}});
   }else if(op.kind==="deck:create"){
    await folder(op.fields.folderId);result=await tx.deck.create({data:{id:op.id,userId:owner,...op.fields,...(op.cards?{cards:{create:op.cards.map((card,i)=>({...card,position:i}))}}:{})}});
   }else if(op.kind==="deck:update"||op.kind==="deck:delete"){
    const deck=await tx.deck.findFirst({where:{id:op.id,userId:owner}});if(!deck)throw new MutationError("Pack not found",404);
    if(changedElsewhere({...deck,archive:!!deck.archivedAt},op.base))throw new MutationError("This pack changed on another device. Your local edit is retained.",409);
    if(op.kind==="deck:delete")result=(await tx.deck.delete({where:{id:op.id}}),{id:op.id,deleted:true});
    else {const {archive,...fields}=op.fields;await folder(fields.folderId);result=await tx.deck.update({where:{id:op.id},data:{...fields,...(archive!==undefined?{archivedAt:archive?new Date():null}:{})}});}
   }else if(op.kind==="folder:create")result=await tx.folder.create({data:{id:op.id,userId:owner,...op.fields}});
   else if(op.kind==="user:goal"){await tx.user.update({where:{id:owner},data:{dailyGoal:op.dailyGoal}});result={dailyGoal:op.dailyGoal};}
   const data=jsonValue(result);await tx.deviceMutation.create({data:{id,userId:owner,requestHash,result:data}});return data;
  },{isolationLevel:"Serializable"});
  return Response.json({recorded:true,result});
 }catch(error){
  if(error instanceof MutationError)return Response.json({error:error.message},{status:error.status});
  // A concurrent delivery may have committed the same event already.
  const receipt=await prisma.deviceMutation.findUnique({where:{id}}).catch(()=>null);
  if(receipt?.requestHash===requestHash)return Response.json({recorded:true,result:receipt.result});
  return Response.json({error:"Could not sync this edit yet. It is still saved on your device."},{status:503});
 }
}
