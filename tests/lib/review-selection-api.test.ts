import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks=vi.hoisted(()=>({auth:vi.fn(),cards:vi.fn(),user:vi.fn(),plan:vi.fn(),previous:vi.fn(),upsert:vi.fn(),logs:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireAuth:mocks.auth}));
vi.mock("@/lib/db",()=>({prisma:{card:{findMany:mocks.cards},user:{findUnique:mocks.user},dailyStudyPlan:{findUnique:mocks.plan,findFirst:mocks.previous,upsert:mocks.upsert},reviewLog:{findMany:mocks.logs}}}));
import { GET } from "@/app/api/review/route";
const card=(id:string,tags="spanish")=>({id,front:id,tags,createdAt:new Date(0),nextReviewAt:new Date(0),easeFactor:2.5,interval:0,repetitions:0,recallStates:[],reviews:[]});
beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue({userId:"owner"});mocks.user.mockResolvedValue({learningLanguage:"Spanish"});});
describe("study selection API",()=>{
  it("keeps one daily plan and resumes only the remaining directions",async()=>{
    const picks=[{id:"a",studyDirection:"front",studyReason:"Needs practice",group:"practice"},{id:"b",studyDirection:"back",studyReason:"Retention",group:"retention"},{id:"archived",studyDirection:"front",studyReason:"New",group:"new"}];
    mocks.plan.mockResolvedValue({createdAt:new Date(0),picks});
    mocks.logs.mockResolvedValue([{cardId:"a",direction:"front",quality:2}]);
    mocks.cards.mockResolvedValueOnce([card("a"),card("b")]).mockResolvedValueOnce([card("b")]);
    const data=await (await GET(new NextRequest("https://huella.example/api/review?filter=daily&limit=1&deckIds=ignored"))).json();
    expect(data.cards.map((c:{id:string})=>c.id)).toEqual(["b"]);
    expect(data.daily).toMatchObject({completed:1,total:2,ratings:{2:1},mix:{practice:1,retention:1,new:0}});
    expect(mocks.plan.mock.calls[0][0].where.userId_day.userId).toBe("owner");
    expect(mocks.logs.mock.calls[0][0].where.card.deck.userId).toBe("owner");
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.previous).not.toHaveBeenCalled();
    expect(mocks.cards.mock.calls[0][0].where.deckId).toBeUndefined();
  });
  it("uses the plan returned by the atomic upsert when two devices start together",async()=>{
    mocks.plan.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue({createdAt:new Date(0),picks:[{id:"b",studyDirection:"back",studyReason:"New",group:"new"}]});
    mocks.logs.mockResolvedValue([]);
    mocks.cards.mockResolvedValueOnce([card("a"),card("b")]).mockResolvedValueOnce([card("b")]);
    const data=await (await GET(new NextRequest("https://huella.example/api/review?filter=daily"))).json();
    expect(data.cards[0]).toMatchObject({id:"b",studyDirection:"back"});
    expect(mocks.upsert.mock.calls[0][0].update).toEqual({});
  });
  it("carries forward the previous owner's learning cohort when creating a new day",async()=>{
    mocks.plan.mockResolvedValue(null);
    mocks.previous.mockResolvedValue({picks:[{id:"kept",studyDirection:"front",studyReason:"New",group:"new"}]});
    mocks.upsert.mockImplementation(async args=>({createdAt:new Date(0),picks:args.create.picks}));
    mocks.logs.mockResolvedValue([]);
    const waiting=Array.from({length:110},(_,i)=>card("waiting"+i));
    mocks.cards.mockResolvedValueOnce([...waiting,card("kept")]).mockResolvedValueOnce([card("kept"),...waiting]);
    const data=await(await GET(new NextRequest("https://huella.example/api/review?filter=daily"))).json();
    expect(data.cards.some((c:{id:string})=>c.id==="kept")).toBe(true);
    expect(data.daily.total).toBe(100);
    expect(mocks.previous.mock.calls[0][0].where).toMatchObject({userId:"owner",day:{lt:expect.any(String)}});
  });
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
