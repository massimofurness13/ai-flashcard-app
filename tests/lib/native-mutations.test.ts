import {describe,it,expect} from "vitest";
import {bearerToken} from "@/lib/supabase/bearer";
import {offlineMutationSchema,changedElsewhere} from "@/lib/offline-mutation-schema";
import {projectMutation,supportsLocalWrite,type PendingMutation} from "../../mobile/offline-api";
const eventId="33333333-3333-4333-8333-333333333333";
const op=(operation:PendingMutation["operation"]):PendingMutation=>({eventId,sequence:1,operation});
describe("installed app edits",()=>{
 it("accepts only bearer JWT syntax; credentials still require server verification",()=>{
  expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  for(const input of [null,"Basic abc","Bearer abc","Bearer a.b.c extra","Bearer a.b.c\n"] )expect(bearerToken(input)).toBeNull();
 });
 it("does not let a card edit change grades, ownership or credits",()=>{
  expect(offlineMutationSchema.safeParse({eventId,operation:{kind:"card:update",id:"c",fields:{front:"hola",quality:4},base:{front:"hello"}}}).success).toBe(false);
  expect(offlineMutationSchema.safeParse({eventId,operation:{kind:"deck:create",id:"d",fields:{name:"Test",userId:"other"}}}).success).toBe(false);
 });
 it("detects an edit to the same fields but tolerates a new review",()=>{
  expect(changedElsewhere({front:"hello",interval:20},{front:"hello"})).toBe(false);
  expect(changedElsewhere({front:"changed"},{front:"hello"})).toBe(true);
 });
 it("keeps a pending edit visible when stale server data arrives",()=>{
  const original={deck:{id:"d",cards:[{id:"c",front:"old"}],_count:{cards:1}}};
  const result=projectMutation("/api/decks/d/view",original,[op({kind:"card:update",id:"c",fields:{front:"new"},base:{front:"old"}})]);
  expect(result.deck.cards[0].front).toBe("new");expect(original.deck.cards[0].front).toBe("old");
 });
 it("deletes only the selected card and updates its pack count",()=>{
  const result=projectMutation("/api/decks/d/view",{deck:{id:"d",cards:[{id:"c"},{id:"other"}],_count:{cards:2}}},[op({kind:"card:delete",id:"c",base:{}})]);
  expect(result.deck.cards.map((c:{id:string})=>c.id)).toEqual(["other"]);expect(result.deck._count.cards).toBe(1);
 });
 it("does not duplicate a created card when an overlay runs twice",()=>{
  const operation=op({kind:"card:create",id:"c",deckId:"d",fields:{front:"hola",back:"hello"}});
  const once=projectMutation("/api/decks/d/view",{deck:{id:"d",cards:[]}},[operation]);
  expect(projectMutation("/api/decks/d/view",once,[operation]).deck.cards).toHaveLength(1);
 });
 it("removes an archived pack from new study selections",()=>{
  const result=projectMutation("/api/study-config",{decks:[{id:"d"},{id:"keep"}]},[op({kind:"deck:update",id:"d",fields:{archive:true},base:{archive:false}})]);
  expect(result.decks.map((d:{id:string})=>d.id)).toEqual(["keep"]);
 });
 it("does not queue generation or payments as an ordinary local edit",()=>{
  expect(supportsLocalWrite("/api/images/generate","POST")).toBe(false);
  expect(supportsLocalWrite("/api/stripe/checkout","POST")).toBe(false);
  expect(supportsLocalWrite("/api/cards/a","PATCH")).toBe(true);
 });
});
