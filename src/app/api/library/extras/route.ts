import {requireAuth} from "@/lib/auth";
import {prisma} from "@/lib/db";
export async function GET(){
 const auth=await requireAuth();if(auth.error)return auth.error;
 const [archivedDecks,creditUsage]=await Promise.all([
  prisma.deck.findMany({where:{userId:auth.userId,archivedAt:{not:null}},select:{id:true,name:true,emoji:true,archivedAt:true},orderBy:{archivedAt:"desc"}}),
  prisma.creditLedger.findMany({where:{userId:auth.userId},orderBy:{createdAt:"desc"},take:250,select:{id:true,delta:true,kind:true,tier:true,deckName:true,note:true,createdAt:true}}),
 ]);
 return Response.json({archivedDecks,creditUsage},{headers:{"Cache-Control":"private, no-store"}});
}
