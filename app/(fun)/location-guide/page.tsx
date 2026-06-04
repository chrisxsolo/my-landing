"use client";
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from "react";
import { GUIDE_STYLES } from "@/lib/guidestyles";
import { C } from "@/lib/colors";
import ExpandableText from "@/app/components/ExpandableText";
import GuideNav from "@/app/components/GuideNav";

export const dynamic = 'force-dynamic'

type LocationSpot = { id:number; school_id:string; school_name:string; school_short:string; name:string; description:string; tip:string; icon:string; image_url:string|null; order:number; };

const SCHOOL_META: Record<string,{emoji:string;tagline:string;gradient:string;gradientSoft:string;border:string;color:string;bar:string;}> = {
  sjsu:     {emoji:"🔵",tagline:"Downtown energy, iconic architecture",gradient:"linear-gradient(135deg,#0055A2,#E5A823)",gradientSoft:"rgba(0,85,162,0.07)",border:"rgba(0,85,162,0.18)",color:"#0055A2",bar:"linear-gradient(180deg,#0055A2,#E5A823)"},
  berkeley: {emoji:"🐻",tagline:"Iconic arches, Sather Gate, golden hillsides",gradient:"linear-gradient(135deg,#003262,#FDB515)",gradientSoft:"rgba(0,50,98,0.07)",border:"rgba(0,50,98,0.18)",color:"#003262",bar:"linear-gradient(180deg,#003262,#FDB515)"},
  sfsu:     {emoji:"🌉",tagline:"Modern campus meets San Francisco backdrops",gradient:"linear-gradient(135deg,#9B1C1F,#F0A500)",gradientSoft:"rgba(155,28,31,0.07)",border:"rgba(155,28,31,0.18)",color:"#9B1C1F",bar:"linear-gradient(180deg,#9B1C1F,#F0A500)"},
  csueb:    {emoji:"🦅",tagline:"Bay views, hillside campus, hidden gems",gradient:"linear-gradient(135deg,#003DA5,#FFB81C)",gradientSoft:"rgba(0,61,165,0.07)",border:"rgba(0,61,165,0.18)",color:"#003DA5",bar:"linear-gradient(180deg,#003DA5,#FFB81C)"},
  usf:      {emoji:"🟢",tagline:"Hilltop campus, Golden Gate Park nearby, city views",gradient:"linear-gradient(135deg,#006636,#A8996E)",gradientSoft:"rgba(0,102,54,0.07)",border:"rgba(0,102,54,0.18)",color:"#006636",bar:"linear-gradient(180deg,#006636,#A8996E)"},
};

const SCHOOL_ORDER = ["sjsu","berkeley","sfsu","csueb","usf"];

const DRAFT_SPOTS: LocationSpot[] = [
  {id:1,school_id:"sjsu",school_name:"San Jose State University",school_short:"SJSU",name:"The SJSU Sign Wall",description:"The big blue SJSU block letters on the side of the building on 7th St. Clean, bold, instantly recognizable. Best in the morning before it gets crowded.",tip:"Arrive before 9am on weekdays for an empty wall.",icon:"🏫",image_url:null,order:1},
  {id:2,school_id:"sjsu",school_name:"San Jose State University",school_short:"SJSU",name:"Tower Hall Steps",description:"The old red-brick Tower Hall is the most architectural building on campus. The front steps and archways give you a classic collegiate look that never goes out of style.",tip:"Overcast days work great here — no harsh shadows on the brick.",icon:"🏛️",image_url:null,order:2},
  {id:3,school_id:"sjsu",school_name:"San Jose State University",school_short:"SJSU",name:"Event Center Plaza",description:"Wide open concrete plaza with palm trees and clean sight lines. Great for walking shots, cap throws, and full-length gown photos.",tip:"The palm trees make great framing for backlit golden hour shots.",icon:"🌴",image_url:null,order:3},
  {id:4,school_id:"sjsu",school_name:"San Jose State University",school_short:"SJSU",name:"MLK Library Steps",description:"The joint SJSU/San Jose Public Library has great steps and glass architecture out front. Modern aesthetic, clean lines, good for editorial-style portraits.",tip:"Late afternoon light hits the glass facade perfectly.",icon:"📚",image_url:null,order:4},
  {id:5,school_id:"sjsu",school_name:"San Jose State University",school_short:"SJSU",name:"Campus Flower Beds & Gardens",description:"Scattered throughout campus near Clark Hall and the quad. Seasonal blooms add color and softness to photos.",tip:"Spring semester has the best blooms — check before your shoot.",icon:"🌸",image_url:null,order:5},
  {id:6,school_id:"berkeley",school_name:"UC Berkeley",school_short:"UC Berkeley",name:"Sather Gate",description:"The most iconic spot on campus. The bronze gate with the campanile in the background is immediately recognizable as Berkeley.",tip:"7–9am on weekdays = nearly empty. Weekends get busy by 10am.",icon:"🚪",image_url:null,order:1},
  {id:7,school_id:"berkeley",school_name:"UC Berkeley",school_short:"UC Berkeley",name:"Doe Memorial Library Steps",description:"Massive stone steps with classical columns. Gives you that timeless university photo. Great for groups and solo shots in full gown.",tip:"Shoot facing west in the late afternoon for beautiful front lighting.",icon:"🏛️",image_url:null,order:2},
  {id:8,school_id:"berkeley",school_name:"UC Berkeley",school_short:"UC Berkeley",name:"Sproul Plaza",description:"The heart of campus. Open space, palm trees, and the Sather Tower in the background. Great for candid walking shots and cap throws.",tip:"The fountain area makes a great foreground element for wide shots.",icon:"🌳",image_url:null,order:3},
  {id:9,school_id:"berkeley",school_name:"UC Berkeley",school_short:"UC Berkeley",name:"The Campanile (Sather Tower)",description:"Shoot at the base looking up, or find a spot where you can frame the full tower behind you. One of the most striking backdrops on any campus.",tip:"Golden hour from the west side of the tower is stunning.",icon:"🗼",image_url:null,order:4},
  {id:10,school_id:"berkeley",school_name:"UC Berkeley",school_short:"UC Berkeley",name:"Faculty Glade",description:"A hidden gem — grassy open field surrounded by redwood trees and a small creek. Natural, serene, completely different vibe from the stone architecture nearby.",tip:"Great for a second look if you want something more natural and editorial.",icon:"🌿",image_url:null,order:5},
  {id:11,school_id:"berkeley",school_name:"UC Berkeley",school_short:"UC Berkeley",name:"Strawberry Creek Path",description:"Wooded path running through campus with dappled light through the trees. Best for candid walking shots and profile portraits in natural shade.",tip:"Midday shade here is perfect when the sun is too harsh elsewhere.",icon:"🌊",image_url:null,order:6},
  {id:12,school_id:"sfsu",school_name:"San Francisco State University",school_short:"SF State",name:"SFSU Sign & Main Entrance",description:"The main campus entrance on 19th Ave has clean signage and a modern feel. Simple, direct, and immediately identifiable as SF State.",tip:"Morning light from the east hits the sign perfectly on clear days.",icon:"🏫",image_url:null,order:1},
  {id:13,school_id:"sfsu",school_name:"San Francisco State University",school_short:"SF State",name:"Cesar Chavez Student Center Steps",description:"The student center has wide concrete steps and an elevated plaza with great sight lines across campus. Good for full-length gown shots.",tip:"The steps face south — great for midday light without squinting.",icon:"🏢",image_url:null,order:2},
  {id:14,school_id:"sfsu",school_name:"San Francisco State University",school_short:"SF State",name:"Campus Green & Open Quad",description:"The central grassy area near the administration building gives you open sky and greenery. Good for movement shots and cap throws.",tip:"Afternoon light from the west gives you long golden shadows across the grass.",icon:"🌿",image_url:null,order:3},
  {id:15,school_id:"sfsu",school_name:"San Francisco State University",school_short:"SF State",name:"Lake Merced (5 min from campus)",description:"A short drive from campus and completely different energy. The lake trail with eucalyptus trees and open water makes for stunning editorial portraits.",tip:"Sunset here is unreal. Plan a second location shoot if you have time.",icon:"🌅",image_url:null,order:4},
  {id:16,school_id:"sfsu",school_name:"San Francisco State University",school_short:"SF State",name:"Twin Peaks Overlook (nearby)",description:"A short drive for an iconic San Francisco skyline backdrop. Cap and gown with the whole city behind you.",tip:"Go 30 min before golden hour. Fog can roll in fast so check the forecast.",icon:"🌁",image_url:null,order:5},
  {id:17,school_id:"csueb",school_name:"Cal State East Bay",school_short:"CSUEB",name:"CSUEB Sign at Main Entrance",description:"The main entrance sign off Carlos Bee Blvd gives you a clean, identifiable campus shot. Simple and works great for the classic 'I graduated here' photo.",tip:"Morning light from the east is ideal before it gets harsh.",icon:"🏫",image_url:null,order:1},
  {id:18,school_id:"csueb",school_name:"Cal State East Bay",school_short:"CSUEB",name:"Central Quad & Open Areas",description:"The open central area gives you wide open sky and the Hayward Hills as a backdrop. Spacious and great for big group shots.",tip:"Best in the late afternoon when the hills glow golden.",icon:"🏔️",image_url:null,order:2},
  {id:19,school_id:"csueb",school_name:"Cal State East Bay",school_short:"CSUEB",name:"Library Terrace & Steps",description:"The library has a multi-level terrace with panoramic views of the Bay and the SF skyline on clear days.",tip:"On clear days you can see SF in the background — check air quality first.",icon:"📚",image_url:null,order:3},
  {id:20,school_id:"csueb",school_name:"Cal State East Bay",school_short:"CSUEB",name:"University Drive Pathway",description:"The main pedestrian pathway through campus lined with trees and light poles. Great for walking shots and candid-style portraits.",tip:"Golden hour from the west end of the path is excellent.",icon:"🌳",image_url:null,order:4},
  {id:21,school_id:"csueb",school_name:"Cal State East Bay",school_short:"CSUEB",name:"Meiklejohn Hall Archway",description:"One of the older buildings on campus with an archway entrance and red brick detail. Classic collegiate feel, good for portrait-style shots.",tip:"Overcast days work well here — consistent soft light through the archway.",icon:"🏛️",image_url:null,order:5},
  {id:22,school_id:"usf",school_name:"University of San Francisco",school_short:"USF",name:"St. Ignatius Church Steps",description:"The massive twin-towered church is USF's most iconic landmark. The wide stone steps and grand facade give you an immediately recognizable backdrop.",tip:"Shoot facing east in the morning for clean front light on the steps.",icon:"⛪",image_url:null,order:1},
  {id:23,school_id:"usf",school_name:"University of San Francisco",school_short:"USF",name:"Lone Mountain Summit",description:"The hilltop behind the Lone Mountain building has one of the best 360-degree views in San Francisco — the city skyline, the Bay, and the Golden Gate on clear days.",tip:"Clear mornings in fall and spring are best. Fog usually burns off by 10am.",icon:"🌁",image_url:null,order:2},
  {id:24,school_id:"usf",school_name:"University of San Francisco",school_short:"USF",name:"Kalmanovitz Hall Archway",description:"The main academic building has a beautiful arched entrance with red brick and ivy detail. Classic collegiate feel — similar energy to Berkeley's Doe Library but far less crowded.",tip:"This spot is shaded most of the day so it works well even at harsh midday sun.",icon:"🏛️",image_url:null,order:3},
  {id:25,school_id:"usf",school_name:"University of San Francisco",school_short:"USF",name:"Golden Gate Park (5 min away)",description:"A short walk or rideshare from campus. The Panhandle entrance, the rose garden, and the Japanese Tea Garden area all make incredible backdrops.",tip:"The rose garden peaks in April–May. Japanese Tea Garden is best on weekdays.",icon:"🌿",image_url:null,order:4},
  {id:26,school_id:"usf",school_name:"University of San Francisco",school_short:"USF",name:"The Main Quad & Lawn",description:"The central grassy quad surrounded by the main academic buildings gives you a clean, open shot with classic university architecture on all sides.",tip:"Golden hour from the west catches the brick buildings perfectly.",icon:"🌳",image_url:null,order:5},
];

const MARQUEE = ["San Jose State","UC Berkeley","SF State","Cal State East Bay","USF","Bay Area","Best Spots","Golden Hour","Campus Shoots","San Jose State","UC Berkeley","SF State","Cal State East Bay","USF","Bay Area","Best Spots","Golden Hour","Campus Shoots"];

export default function LocationGuidePage() {
  const [spots, setSpots] = useState<LocationSpot[]>(DRAFT_SPOTS);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    async function fetchSpots(){
      try{
        const{data,error}=await supabase.from('location_spots').select('*').order('school_id').order('order',{ascending:true})
        if(error)console.error(error)
        if(data&&data.length>0){
          const supabaseIds=new Set(data.map(s=>s.school_id))
          const draftFallback=DRAFT_SPOTS.filter(s=>!supabaseIds.has(s.school_id))
          setSpots([...data,...draftFallback])
        }
      }catch(err){console.error(err)}
      finally{setLoading(false)}
    }
    fetchSpots()
  },[])

  const spotsBySchool=SCHOOL_ORDER.reduce((acc,id)=>{acc[id]=spots.filter(s=>s.school_id===id);return acc},{} as Record<string,LocationSpot[]>)
  const schoolInfo=SCHOOL_ORDER.reduce((acc,id)=>{const f=spots.find(s=>s.school_id===id);if(f)acc[id]={name:f.school_name,short:f.school_short};return acc},{} as Record<string,{name:string;short:string}>)

  return (
    <div className="min-h-screen font-sans overflow-x-hidden" style={{ background: C.page }}>
      <style>{GUIDE_STYLES}</style>


      <section className="relative overflow-hidden px-6 pt-16 pb-14 border-b" style={{ borderColor: C.borderSubtle }}>
        <div className="absolute inset-0 pointer-events-none" style={C.gridBg(0.04)}/>
        <div className="absolute inset-0 pointer-events-none" style={C.vignette}/>
        <div className="absolute top-5 left-5 w-5 h-5 pointer-events-none" style={{borderTop:`2px solid ${C.p1_30}`,borderLeft:`2px solid ${C.p1_30}`}}/>
        <div className="absolute top-5 right-5 w-5 h-5 pointer-events-none" style={{borderTop:`2px solid ${C.p2_18}`,borderRight:`2px solid ${C.p2_18}`}}/>
        <div className="absolute bottom-5 left-5 w-5 h-5 pointer-events-none" style={{borderBottom:`2px solid ${C.p2_18}`,borderLeft:`2px solid ${C.p2_18}`}}/>
        <div className="absolute bottom-5 right-5 w-5 h-5 pointer-events-none" style={{borderBottom:`2px solid ${C.p3_15}`,borderRight:`2px solid ${C.p3_15}`}}/>
        <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{background:C.grad12}}/>
        <div className="pdot absolute bottom-8 left-8 w-1.5 h-1.5 rounded-full pointer-events-none" style={{background:C.grad23,animationDelay:"1s"}}/>
        <div className="blob1 absolute rounded-full pointer-events-none" style={{width:520,height:520,top:-130,left:-110,background:C.blob1}}/>
        <div className="blob2 absolute rounded-full pointer-events-none" style={{width:400,height:400,top:-70,right:-90,background:C.blob2}}/>
        <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" style={{opacity:0.4,animation:"fadeIn 1s 0.6s ease both"}}>
          <svg width="110" height="220" viewBox="0 0 110 220" fill="none">
            <defs><linearGradient id="lsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.p1}/><stop offset="50%" stopColor={C.p2}/><stop offset="100%" stopColor={C.p3}/></linearGradient></defs>
            <path className="sqp1" d="M55 6 C80 22,30 46,55 72 C80 98,30 120,55 148 C80 176,30 196,55 216" stroke="url(#lsg)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path className="sqp2" d="M35 20 C60 36,10 60,35 86 C60 112,10 136,35 162 C60 188,10 206,35 218" stroke={C.p2} strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.3"/>
            <circle cx="55" cy="6"   r="2.5" fill={C.p1} opacity="0.8"/>
            <circle cx="55" cy="72"  r="2.5" fill={C.p2} opacity="0.8"/>
            <circle cx="55" cy="148" r="2.5" fill={C.p3} opacity="0.8"/>
            <circle cx="55" cy="216" r="2.5" fill={C.p1} opacity="0.8"/>
          </svg>
        </div>
        <div className="spin absolute -bottom-10 -left-10 pointer-events-none hidden sm:block" style={{opacity:0.08}}>
          <svg width="140" height="140" viewBox="0 0 140 140"><circle cx="70" cy="70" r="60" stroke={C.p1} strokeWidth="1" fill="none" strokeDasharray="8 6"/></svg>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="afu1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5" style={{background:C.p1_08,border:`1px solid ${C.p1_20}`}}>
            <div className="pdot w-1.5 h-1.5 rounded-full" style={{background:C.grad12}}/>
            <p className="text-xs font-bold tracking-[0.12em] uppercase" style={{color:C.p1}}>Bay Area Campus Guide</p>
          </div>
          <h1 className="afu2 text-5xl sm:text-6xl font-black tracking-tight leading-tight text-slate-900 mb-2">Best spots to</h1>
          <p className="afu3 text-5xl sm:text-6xl font-light italic tracking-tight text-slate-900 mb-6">
            <span style={C.text}>shoot at.</span>
            <span className="cblink inline-block w-[3px] h-[44px] sm:h-[52px] ml-1.5 rounded-sm align-middle" style={{background:C.grad12}}/>
          </p>
          <p className="afu4 text-lg text-slate-600 font-light leading-relaxed max-w-lg mx-auto mb-8">Four Bay Area campuses, broken down spot by spot. Where to go, what to expect, and the best time to show up.</p>
          <div className="afu4 flex flex-wrap justify-center gap-2">
            {SCHOOL_ORDER.map(id=>{const meta=SCHOOL_META[id];const info=schoolInfo[id];return(
              <a key={id} href={`#${id}`} className="btn-lift px-4 py-2 rounded-full text-xs font-bold text-white" style={{background:meta.gradient}}>{info?.short??id.toUpperCase()}</a>
            )})}
          </div>
        </div>
      </section>

      <div className="overflow-hidden border-b py-3" style={{ borderColor: C.borderSubtle, background: C.surfaceStrong }}>
        <div className="mtrack flex gap-12 whitespace-nowrap w-max">
          {MARQUEE.map((item,i)=>(
            <span key={i} className="flex items-center gap-3 text-[11px] font-bold tracking-[0.14em] uppercase text-slate-300">
              {item}<span className="w-[4px] h-[4px] rounded-full flex-shrink-0" style={{background:C.grad12}}/>
            </span>
          ))}
        </div>
      </div>

      <div className="px-6 py-14 space-y-24">
        {loading ? (
          [...Array(4)].map((_,i)=>(
            <div key={i} className="max-w-3xl mx-auto space-y-4">
              <div className="rounded-2xl animate-pulse h-28" style={{background:`linear-gradient(135deg,${C.p1_08},${C.p2_06})`}}/>
              {[...Array(3)].map((_,j)=><div key={j} className="rounded-2xl animate-pulse h-48" style={{background:`linear-gradient(135deg,${C.p1_06},${C.p2_06})`}}/>)}
            </div>
          ))
        ) : (
          SCHOOL_ORDER.map((schoolId,si)=>{
            const meta=SCHOOL_META[schoolId];
            const schoolSpots=spotsBySchool[schoolId]??[];
            const info=schoolInfo[schoolId];
            if(!info)return null;
            return(
              <section key={schoolId} id={schoolId} className="max-w-3xl mx-auto scroll-mt-20">
                <div className="relative rounded-2xl p-7 mb-8 overflow-hidden text-white" style={{background:meta.gradient}}>
                  <div className="absolute inset-0 pointer-events-none" style={C.ctaGrid}/>
                  <div className="absolute bottom-3 right-4 opacity-20 pointer-events-none">
                    <svg width="50" height="80" viewBox="0 0 50 80" fill="none"><path d="M25 4 C38 16,12 28,25 44 C38 60,12 70,25 78" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/><circle cx="25" cy="4" r="2" fill="white" opacity="0.8"/><circle cx="25" cy="44" r="2" fill="white" opacity="0.8"/><circle cx="25" cy="78" r="2" fill="white" opacity="0.8"/></svg>
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{meta.emoji}</span>
                      <span className="text-xs font-bold tracking-[0.15em] uppercase text-white/60">{String(si+1).padStart(2,"0")} — {schoolSpots.length} spots</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black leading-tight mb-1">{info.name}</h2>
                    <p className="text-white/70 text-sm font-light">{meta.tagline}</p>
                  </div>
                </div>

                <div className="space-y-5">
                  {schoolSpots.map((spot,i)=>(
                    <div key={spot.id} className="card-lift rounded-2xl overflow-hidden" style={{border:`1px solid ${meta.border}`,background:C.surfaceStrong, boxShadow:C.shadowWarmSm}}>
                      <div className="h-[3px]" style={{background:meta.gradient}}/>
                      {spot.image_url ? (
                        <div className="flex flex-col sm:grid sm:grid-cols-2">
                          <div className="w-full h-72 sm:h-auto overflow-hidden relative" style={{background:"#f1f5f9"}}>
                            <img src={spot.image_url} alt={spot.name} className="w-full h-full object-cover"/>
                            <div className="absolute top-3 left-3"><span className="text-xs font-black px-2.5 py-1 rounded-full text-white" style={{background:meta.gradient}}>SPOT {String(i+1).padStart(2,"0")}</span></div>
                          </div>
                          <div className="p-6 flex flex-col justify-center">
                            <h3 className="text-lg font-black text-slate-900 mb-2 leading-tight">{spot.name}</h3>
                            <div className="mb-4">
                              <ExpandableText
                                text={spot.description}
                                className="text-slate-600 text-sm leading-relaxed"
                                buttonColor={meta.color}
                              />
                            </div>
                            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5" style={{background:meta.gradientSoft,border:`1px solid ${meta.border}`}}>
                              <span className="text-xs font-black uppercase tracking-wider mt-0.5 flex-shrink-0" style={{color:meta.color}}>Tip</span>
                              <p className="text-xs leading-relaxed" style={{color:meta.color}}>{spot.tip}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2">
                          <div className="hidden sm:flex items-center justify-center relative overflow-hidden" style={{minHeight:240,background:meta.gradientSoft}}>
                            <div className="absolute inset-0 pointer-events-none" style={C.gridBg(0.06)}/>
                            <div className="text-center relative z-10"><p className="text-4xl mb-2">{spot.icon}</p><p className="text-xs font-semibold" style={{color:meta.color}}>Photo via Supabase</p></div>
                          </div>
                          <div className="p-6 flex flex-col justify-center">
                            <div className="mb-3"><span className="text-xs font-black tracking-widest px-2.5 py-1 rounded-full" style={{color:meta.color,background:meta.gradientSoft}}>SPOT {String(i+1).padStart(2,"0")}</span></div>
                            <h3 className="text-lg font-black text-slate-900 mb-2 leading-tight">{spot.name}</h3>
                            <div className="mb-4">
                              <ExpandableText
                                text={spot.description}
                                className="text-slate-600 text-sm leading-relaxed"
                                buttonColor={meta.color}
                              />
                            </div>
                            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5" style={{background:meta.gradientSoft,border:`1px solid ${meta.border}`}}>
                              <span className="text-xs font-black uppercase tracking-wider mt-0.5 flex-shrink-0" style={{color:meta.color}}>Tip</span>
                              <p className="text-xs leading-relaxed" style={{color:meta.color}}>{spot.tip}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-6 text-center"><a href="#" className="text-xs font-bold tracking-widest uppercase text-slate-400 hover:text-slate-600 transition-colors">↑ Back to top</a></div>
              </section>
            );
          })
        )}
      </div>

      <div className="px-6 pb-20">
        <div className="max-w-3xl mx-auto rounded-2xl p-10 text-center relative overflow-hidden" style={{background:C.grad}}>
          <div className="absolute inset-0 pointer-events-none" style={C.ctaGridLg}/>
          <div className="absolute top-4 right-6 opacity-15 pointer-events-none"><svg width="50" height="80" viewBox="0 0 50 80" fill="none"><path d="M25 4 C38 16,12 28,25 44 C38 60,12 70,25 78" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
          <h3 className="relative text-3xl font-black text-white mb-2 tracking-tight">Know your spots.<br/>Now book the shoot.</h3>
          <p className="relative text-white/75 mb-7 text-sm font-light">Tell me which locations you want and we'll plan the whole session around them.</p>
          <a href="https://www.soloxsnaps.com/contact/" className="btn-lift relative inline-block px-8 py-3 rounded-full bg-white font-bold text-sm" style={{color:C.p1}}>Book your shoot →</a>
        </div>
      </div>

      <GuideNav />
      <footer className="border-t py-8 px-6" style={{ borderColor: C.borderSubtle, background: C.surfaceStrong }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg" style={C.text}>soloxsnaps</span>
          <span className="text-sm text-slate-400">© 2026 · soloxsnaps · Bay Area photography</span>
        </div>
      </footer>
    </div>
  );
}
