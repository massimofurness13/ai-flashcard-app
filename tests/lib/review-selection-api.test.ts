import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks=vi.hoisted(()=>({auth:vi.fn(),cards:vi.fn(),user:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireAuth:mocks.auth}));
vi.mock("@/lib/db",()=>({prisma:{card:{findMany:mocks.cards},user:{findUnique:mocks.user}}}));
import { GET } from "@/app/api/review/route";
const card=(id:string,tags="spanish")=>({id,front:id,tags,createdAt:new Date(0),nextReviewAt:new Date(0),easeFactor:2.5,interval:0,repetitions:0,recallStates:[],reviews:[]});
beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue({userId:"owner"});mocks.user.mockResolvedValue({learningLanguage:"Spanish"});});
describe("study selection API",()=>{
  it("scans past 1000 cards and applies tags before counting or selecting",async()=>{
    const later=card("later","target");
    mocks.cards.mockResolvedValueOnce(Array.from({length:1000},(_,i)=>card(String(i)))).mockResolvedValueOnce([later]).mockResolvedValueOnce([{...later,back:"translation",deck:{name:"Pack"}}]);
    const response=await GET(new NextRequest("https://huella.example/api/review?filter=mastery&tags=target&deckIds=pack&limit=20"));
    const result=await response.json();
    expect(result.total).toBe(1);expect(result.cards[0].id).toBe("later");
    expect(mocks.cards.mock.calls[0][0].where).toEqual({deck:{userId:"owner",archivedAt:null},deckId:{in:["pack"]}});
    expect(mocks.cards.mock.calls[1][0].cursor).toEqual({id:"999"});
    expect(mocks.cards.mock.calls[2][0].where.deck.userId).toBe("owner");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("paginates practice consistently without padding it with repeats",async()=>{
    const cards=[card("c"),card("b"),card("a")];
    mocks.cards.mockResolvedValueOnce(cards).mockResolvedValueOnce([cards[1]]);
    const result=await (await GET(new NextRequest("https://huella.example/api/review?filter=mastery&limit=1&offset=1"))).json();
    expect(result.cards.map((c:{id:string})=>c.id)).toEqual(["b"]);
    expect(result.total).toBe(3);expect(result.nextOffset).toBe(2);
  });
  it("does not query another account after an authentication failure",async()=>{
    mocks.auth.mockResolvedValue({error:new Response(null,{status:401})});
    expect((await GET(new NextRequest("https://huella.example/api/review"))).status).toBe(401);
    expect(mocks.cards).not.toHaveBeenCalled();
  });
});
