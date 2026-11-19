import {createRoot} from "react-dom/client";
import {Suspense,Component,useEffect,type ReactNode,type ComponentProps} from "react";
import {ThemeProvider,useTheme} from "next-themes";
import {StatusBar,Style} from "@capacitor/status-bar";
import {DeviceProvider,useDeviceAccount} from "@/components/layout/device-provider";
import {Navbar} from "@/components/layout/navbar";
import {MobileNav} from "@/components/layout/mobile-nav";
import {FontSizeInit} from "@/components/layout/font-size-init";
import {OfflineStudyProvider} from "@/components/layout/offline-study-provider";
import {SavedDataState} from "@/components/layout/saved-data-state";
import {HomePage} from "@/app/home-client";
import Study from "@/app/study/page";
import Session from "@/app/study/session/page";
import Stats from "@/app/stats/page";
import Account from "@/app/account/page";
import Downloads from "@/app/account/downloads/page";
import Login from "@/app/auth/login/page";
import Signup from "@/app/auth/signup/page";
import Practice from "@/app/study/needs-practice/page";
import Privacy from "@/app/privacy/page";
import Terms from "@/app/terms/page";
import Contact from "@/app/contact/page";
import About from "@/app/about/page";
import Updates from "@/app/updates/page";
import CheckoutDone from "@/app/checkout/done/page";
import CheckoutCancelled from "@/app/checkout/cancelled/page";
import Help from "@/app/help/page";
import {Archive,Usage,SyncState} from "./saved-pages";
import Billing from "@/app/account/billing/page";
import Pricing from "@/app/pricing/page";
import {GenerateClient} from "@/app/generate/generate-client";
import {ImportClient} from "@/app/import/import-client";
import {EditCardsClient} from "@/app/decks/[deckId]/cards/edit/edit-cards-client";
import {DeckView} from "@/app/decks/[deckId]/deck-view";
import {FlashcardForm} from "@/components/flashcard/flashcard-form";
import {DeckForm} from "@/components/deck/deck-form";
import {useDeviceQuery} from "@/hooks/use-device-query";
import {usePathname} from "./navigation";
import Link from "./link";
import {isNativeDevice,NativeStore} from "@/lib/native-device";
import {createClient} from "./auth";
import {installApiTransport} from "./http";
import "@/app/globals.css";
import "./native.css";
installApiTransport(async()=>{const {data}=await createClient().auth.getSession();return data.session?{accessToken:data.session.access_token,userId:data.session.user.id}:null;});
function NativeAppearance(){const {resolvedTheme}=useTheme();useEffect(()=>{if(isNativeDevice())void StatusBar.setStyle({style:resolvedTheme==="dark"?Style.Dark:Style.Light}).catch(()=>{});},[resolvedTheme]);return null;}
function Home(){const {data,error,refresh}=useDeviceQuery<ComponentProps<typeof HomePage>>("/api/library");return data?<HomePage {...data}/>:<SavedDataState error={error} retry={refresh}/>;}
function Pack({deckId,path}:{deckId:string;path:string}){
 const {data,error,refresh}=useDeviceQuery<ComponentProps<typeof DeckView>>(`/api/decks/${deckId}/view`);
 if(!data)return <SavedDataState error={error} retry={refresh}/>;
 const cardId=path.match(/\/cards\/([^/]+)\/edit$/)?.[1];
 if(path.endsWith("/cards/edit"))return <EditCardsClient deckId={deckId} deckName={data.deck.name} deckEmoji={data.deck.emoji} initialCards={data.deck.cards} isPro={data.isPro??false}/>;
 if(cardId){const card=data.deck.cards.find(c=>c.id===cardId);return card?<FlashcardForm deckId={deckId} mode="edit" initialData={card} isPro={data.isPro}/>:<p>This card is no longer in this pack.</p>;}
 if(path.endsWith("/cards/new"))return <FlashcardForm deckId={deckId} mode="create" isPro={data.isPro??false}/>;
 if(path===`/decks/${deckId}/edit`)return <DeckForm mode="edit" initialData={{...data.deck,folderId:data.deck.folder?.id??null,frontVoice:null,backVoice:null,frontLanguageCode:data.deck.frontLanguageCode??null,backLanguageCode:data.deck.backLanguageCode??null}} previewCard={data.deck.cards[0]}/>;
 return <DeckView {...data}/>;
}
function Creation({mode}:{mode:"generate"|"import"}){const {data}=useDeviceQuery<{decks:Array<{id:string;name:string;emoji:string|null}>}>("/api/study-config");const {data:subscription}=useDeviceQuery<{isPro:boolean}>("/api/subscription/status");return mode==="generate"?<GenerateClient decks={data?.decks??[]} isPro={subscription?.isPro??false}/>:<ImportClient decks={data?.decks??[]} isPro={subscription?.isPro??false}/>;}
function Routes(){
 const path=usePathname();const {user,ready}=useDeviceAccount();
 if(!ready)return <p role="status">Opening your saved library…</p>;
 if(path==="/auth/login")return <Login/>;
 if(!user)return path==="/auth/signup"?<Signup/>:<Login/>;
 if(path==="/")return <Home/>;
 if(path==="/study")return <Study/>;
 if(path==="/study/needs-practice")return <Practice/>;
 if(path==="/archive")return <Archive/>;
 if(path==="/usage")return <Usage/>;
 if(path==="/privacy")return <Privacy/>;
 if(path==="/terms")return <Terms/>;
 if(path==="/help")return <Help/>;
 if(path==="/contact")return <Contact/>;
 if(path==="/about")return <About/>;
 if(path==="/updates")return <Updates/>;
 if(path==="/checkout/done")return <CheckoutDone/>;
 if(path==="/checkout/cancelled")return <CheckoutCancelled/>;
 if(path==="/study/session")return <Session/>;
 if(path==="/stats")return <Stats/>;
 if(path==="/account")return <Account/>;
 if(path==="/account/billing")return <Billing/>;
 if(path==="/pricing")return <Pricing/>;
 if(path==="/generate")return <Creation mode="generate"/>;
 if(path==="/import")return <Creation mode="import"/>;
 if(path==="/account/downloads")return <Downloads/>;
 if(path==="/decks/new")return <DeckForm mode="create"/>;
 const deck=path.match(/^\/decks\/([^/]+)/)?.[1];
 if(deck)return <Pack key={path} deckId={deck} path={path}/>;
 return <div><h1>Page not found</h1><p>Your library is still saved on this iPhone.</p><Link href="/">Go home</Link></div>;
}
class Boundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div role="alert" className="p-6"><h1>Huella couldn’t open this screen</h1><p>Your saved work has not been cleared.</p><button onClick={()=>location.reload()}>Reopen app</button></div>:this.props.children;}
}
const root=createRoot(document.getElementById("root")!);
function renderApp(){root.render(<Boundary><ThemeProvider attribute="class" defaultTheme="system" enableSystem><DeviceProvider><NativeAppearance/><FontSizeInit/><Navbar/><OfflineStudyProvider/><SyncState/><main className="app-content flex-1"><div className="mx-auto max-w-7xl px-4 py-6"><Suspense fallback={<p>Opening…</p>}><Routes/></Suspense></div></main><MobileNav/></DeviceProvider></ThemeProvider></Boundary>);}
async function boot(){
 if(isNativeDevice()){
  root.render(<div className="p-6" role="status">Opening Huella and keeping your saved work…</div>);
  try {
   const result=await NativeStore.migrateLegacy();
   if(!result.complete){root.render(<div className="p-6"><h1>Finish this app upgrade</h1><p>Connect once so Huella can move your previous saved library into the installed app. Your existing work has not been deleted.</p><button onClick={()=>void boot()}>Try again</button></div>);return;}
   const storage=result.storage??(await NativeStore.read({owner:"__device__",key:"legacy-storage"})).record?.value as Record<string,string>|undefined;
   if(storage)for(const [key,value] of Object.entries(storage))if(localStorage.getItem(key)===null)localStorage.setItem(key,value);
  }catch{root.render(<div className="p-6"><p>Your saved library could not be opened. It has not been cleared.</p><button onClick={()=>void boot()}>Try again</button></div>);return;}
 }
 renderApp();
}
void boot();
