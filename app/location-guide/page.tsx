"use client";
import Link from "next/link";
import { GUIDE_STYLES } from "@/lib/guidestyles";

export const dynamic = 'force-dynamic'

const MARQUEE = ["San Jose State","UC Berkeley","SF State","Cal State East Bay","Bay Area","Best Spots","Golden Hour","Campus Shoots","San Jose State","UC Berkeley","SF State","Cal State East Bay","Bay Area","Best Spots","Golden Hour","Campus Shoots"];

const schools = [
  {
    id: "sjsu",
    name: "San Jose State University",
    short: "SJSU",
    color: "#0055A2",
    accent: "#E5A823",
    gradient: "linear-gradient(135deg,#0055A2,#E5A823)",
    gradientSoft: "linear-gradient(135deg,rgba(0,85,162,0.08),rgba(229,168,35,0.08))",
    border: "rgba(0,85,162,0.2)",
    emoji: "🔵",
    tagline: "Downtown energy, iconic architecture",
    spots: [
      {
        name: "The SJSU Sign Wall",
        desc: "The big blue SJSU block letters on the side of the building on 7th St. Clean, bold, instantly recognizable. Best in the morning before it gets crowded.",
        tip: "Arrive before 9am on weekdays for an empty wall.",
        icon: "🏫",
      },
      {
        name: "Tower Hall Steps",
        desc: "The old red-brick Tower Hall is the most architectural building on campus. The front steps and archways give you a classic collegiate look that never goes out of style.",
        tip: "Overcast days work great here — no harsh shadows on the brick.",
        icon: "🏛️",
      },
    ],
  },
  {
    id: "berkeley",
    name: "UC Berkeley",
    short: "UC Berkeley",
    color: "#003262",
    accent: "#FDB515",
    gradient: "linear-gradient(135deg,#003262,#FDB515)",
    gradientSoft: "linear-gradient(135deg,rgba(0,50,98,0.08),rgba(253,181,21,0.08))",
    border: "rgba(0,50,98,0.2)",
    emoji: "🐻",
    tagline: "Iconic arches, Sather Gate, golden hillsides",
    spots: [
      {
        name: "Sather Gate",
        desc: "The most iconic spot on campus. The bronze gate with the campanile in the background is immediately recognizable as Berkeley. Go early morning for soft light and no crowds.",
        tip: "7–9am on weekdays = nearly empty. Weekends get busy by 10am.",
        icon: "🚪",
      },
      {
        name: "Doe Memorial Library Steps",
        desc: "Massive stone steps with classical columns. Gives you that timeless university photo that reads anywhere. Great for groups and solo shots in full gown.",
        tip: "Shoot facing west in the late afternoon for beautiful front lighting.",
        icon: "🏛️",
      },
      {
        name: "The Campanile (Sather Tower)",
        desc: "Shoot at the base looking up, or find a spot on the nearby path where you can frame the full tower behind you. One of the most striking backdrops on any campus.",
        tip: "Golden hour from the west side of the tower is stunning.",
        icon: "🗼",
      },
    ],
  },
  {
    id: "sfsu",
    name: "San Francisco State University",
    short: "SF State",
    color: "#9B1C1F",
    accent: "#F0A500",
    gradient: "linear-gradient(135deg,#9B1C1F,#F0A500)",
    gradientSoft: "linear-gradient(135deg,rgba(155,28,31,0.08),rgba(240,165,0,0.08))",
    border: "rgba(155,28,31,0.2)",
    emoji: "🌉",
    tagline: "Modern campus meets San Francisco backdrops",
    spots: [
      {
        name: "SFSU Sign & Main Entrance",
        desc: "The main campus entrance on 19th Ave has clean signage and a modern feel. Simple, direct, and immediately identifiable as SF State.",
        tip: "Morning light from the east hits the sign perfectly on clear days.",
        icon: "🏫",
      },
      {
        name: "Cesar Chavez Student Center Steps",
        desc: "The student center has wide concrete steps and an elevated plaza with great sight lines across campus. Modern architecture, good for full-length gown shots.",
        tip: "The steps face south — great for midday light without squinting.",
        icon: "🏢",
      },
      {
        name: "Campus Green & Open Quad",
        desc: "The central grassy area near the administration building gives you open sky and greenery. Clean, spacious, good for movement shots and cap throws.",
        tip: "Afternoon light from the west gives you long golden shadows across the grass.",
        icon: "🌿",
      },
    ],
  },
  {
    id: "csueb",
    name: "Cal State East Bay",
    short: "CSUEB",
    color: "#003DA5",
    accent: "#FFB81C",
    gradient: "linear-gradient(135deg,#003DA5,#FFB81C)",
    gradientSoft: "linear-gradient(135deg,rgba(0,61,165,0.08),rgba(255,184,28,0.08))",
    border: "rgba(0,61,165,0.2)",
    emoji: "🦅",
    tagline: "Bay views, hillside campus, hidden gems",
    spots: [
      {
        name: "CSUEB Sign at Main Entrance",
        desc: "The main entrance sign off Carlos Bee Blvd gives you a clean, identifiable campus shot. Simple and works great for the classic 'I graduated here' photo.",
        tip: "Morning light from the east is ideal before it gets harsh.",
        icon: "🏫",
      },
      {
        name: "Warren Hall Demolition Site / New Quad",
        desc: "The open central area near the new construction gives you wide open sky and the Hayward Hills as a backdrop. Spacious and great for big group shots.",
        tip: "Best in the late afternoon when the hills glow golden.",
        icon: "🏔️",
      },
      {
        name: "Library Terrace & Steps",
        desc: "The library has a multi-level terrace with panoramic views of the Bay and the SF skyline on clear days. One of the best kept secrets for graduation photos in the East Bay.",
        tip: "On clear days you can see SF in the background — check air quality first.",
        icon: "📚",
      },
      {
        name: "University Drive Pathway",
        desc: "The main pedestrian pathway through campus lined with trees and light poles. Great for walking shots and candid-style portraits with depth in the background.",
        tip: "Golden hour from the west end of the path is excellent.",
        icon: "🌳",
      },
      {
        name: "Meiklejohn Hall Archway",
        desc: "One of the older buildings on campus with an archway entrance and red brick detail. Classic collegiate feel, good for portrait-style shots framed by the architecture.",
        tip: "Overcast days work well here — consistent soft light through the archway.",
        icon: "🏛️",
      },
    ],
  },
];

export default function LocationGuidePage() {
  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      <style>{GUIDE_STYLES}</style>

      {/* NAVBAR */}
      <nav className="af sticky top-0 z-50 backdrop-blur-xl border-b border-black/[0.06]" style={{background:"rgba(255,255,255,0.9)"}}>
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-black text-lg tracking-tight" style={{background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Chris.</Link>
          <Link href="/" className="text-sm font-bold text-slate-700 hover:text-slate-400 transition-colors">← Back to hub</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden px-6 pt-16 pb-14 border-b border-black/[0.06]">
        {/* Grid */}
        <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:`linear-gradient(rgba(124,58,237,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px)`,backgroundSize:"40px 40px"}}/>
        <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse at 50% 50%,transparent 30%,white 78%)"}}/>
        {/* Corner brackets */}
        <div className="absolute top-5 left-5 w-5 h-5 pointer-events-none" style={{borderTop:"2px solid rgba(124,58,237,0.3)",borderLeft:"2px solid rgba(124,58,237,0.3)"}}/>
        <div className="absolute top-5 right-5 w-5 h-5 pointer-events-none" style={{borderTop:"2px solid rgba(219,39,119,0.3)",borderRight:"2px solid rgba(219,39,119,0.3)"}}/>
        <div className="absolute bottom-5 left-5 w-5 h-5 pointer-events-none" style={{borderBottom:"2px solid rgba(219,39,119,0.3)",borderLeft:"2px solid rgba(219,39,119,0.3)"}}/>
        <div className="absolute bottom-5 right-5 w-5 h-5 pointer-events-none" style={{borderBottom:"2px solid rgba(245,158,11,0.3)",borderRight:"2px solid rgba(245,158,11,0.3)"}}/>
        {/* Pulse dots */}
        <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}/>
        <div className="pdot absolute bottom-8 left-8 w-1.5 h-1.5 rounded-full pointer-events-none" style={{background:"linear-gradient(135deg,#db2777,#f59e0b)",animationDelay:"1s"}}/>
        {/* Blobs */}
        <div className="blob1 absolute rounded-full pointer-events-none" style={{width:520,height:520,top:-130,left:-110,background:"radial-gradient(circle,rgba(124,58,237,0.12),transparent 70%)"}}/>
        <div className="blob2 absolute rounded-full pointer-events-none" style={{width:400,height:400,top:-70,right:-90,background:"radial-gradient(circle,rgba(219,39,119,0.09),transparent 70%)"}}/>
        {/* Squiggle */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" style={{opacity:0.4,animation:"fadeIn 1s 0.6s ease both"}}>
          <svg width="110" height="220" viewBox="0 0 110 220" fill="none">
            <defs>
              <linearGradient id="lsg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c3aed"/><stop offset="50%" stopColor="#db2777"/><stop offset="100%" stopColor="#f59e0b"/></linearGradient>
            </defs>
            <path className="sqp1" d="M55 6 C80 22,30 46,55 72 C80 98,30 120,55 148 C80 176,30 196,55 216" stroke="url(#lsg1)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path className="sqp2" d="M35 20 C60 36,10 60,35 86 C60 112,10 136,35 162 C60 188,10 206,35 218" stroke="#db2777" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.3"/>
            <circle cx="55" cy="6"   r="2.5" fill="#7c3aed" opacity="0.8"/>
            <circle cx="55" cy="72"  r="2.5" fill="#db2777" opacity="0.8"/>
            <circle cx="55" cy="148" r="2.5" fill="#f59e0b" opacity="0.8"/>
            <circle cx="55" cy="216" r="2.5" fill="#7c3aed" opacity="0.8"/>
          </svg>
        </div>
        {/* Spinning ring */}
        <div className="spin absolute -bottom-10 -left-10 pointer-events-none hidden sm:block" style={{opacity:0.08}}>
          <svg width="140" height="140" viewBox="0 0 140 140"><circle cx="70" cy="70" r="60" stroke="#7c3aed" strokeWidth="1" fill="none" strokeDasharray="8 6"/></svg>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="afu1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5" style={{background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.2)"}}>
            <div className="pdot w-1.5 h-1.5 rounded-full" style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}/>
            <p className="text-xs font-bold tracking-[0.12em] uppercase text-violet-700">Bay Area Campus Guide</p>
          </div>
          <h1 className="afu2 text-5xl sm:text-6xl font-black tracking-tight leading-tight text-slate-900 mb-2">
            Best spots to
          </h1>
          <p className="afu3 text-5xl sm:text-6xl font-light italic tracking-tight text-slate-900 mb-6">
            <span style={{background:"linear-gradient(135deg,#7c3aed,#db2777,#f59e0b)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>shoot at.</span>
            <span className="cblink inline-block w-[3px] h-[44px] sm:h-[52px] ml-1.5 rounded-sm align-middle" style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}/>
          </p>
          <p className="afu4 text-lg text-slate-600 font-light leading-relaxed max-w-lg mx-auto mb-8">
            Four Bay Area campuses, broken down spot by spot. Where to go, what to expect, and the best time to show up.
          </p>

          {/* School jump links */}
          <div className="afu4 flex flex-wrap justify-center gap-2">
            {schools.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="btn-lift px-4 py-2 rounded-full text-xs font-bold text-white" style={{background:s.gradient}}>
                {s.short}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden border-b border-black/[0.06] py-3">
        <div className="mtrack flex gap-12 whitespace-nowrap w-max">
          {MARQUEE.map((item,i) => (
            <span key={i} className="flex items-center gap-3 text-[11px] font-bold tracking-[0.14em] uppercase text-slate-300">
              {item}<span className="w-[4px] h-[4px] rounded-full flex-shrink-0" style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}/>
            </span>
          ))}
        </div>
      </div>

      {/* SCHOOLS */}
      <div className="px-6 py-14 space-y-24">
        {schools.map((school, si) => (
          <section key={school.id} id={school.id} className="max-w-3xl mx-auto scroll-mt-20">

            {/* School header */}
            <div className="relative rounded-2xl p-7 mb-8 overflow-hidden text-white" style={{background:school.gradient}}>
              <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,backgroundSize:"20px 20px"}}/>
              {/* Squiggle decoration on school header */}
              <div className="absolute bottom-3 right-4 opacity-20 pointer-events-none">
                <svg width="50" height="80" viewBox="0 0 50 80" fill="none"><path d="M25 4 C38 16,12 28,25 44 C38 60,12 70,25 78" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/><circle cx="25" cy="4" r="2" fill="white" opacity="0.8"/><circle cx="25" cy="44" r="2" fill="white" opacity="0.8"/><circle cx="25" cy="78" r="2" fill="white" opacity="0.8"/></svg>
              </div>
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{school.emoji}</span>
                    <span className="text-xs font-bold tracking-[0.15em] uppercase text-white/60">{String(si + 1).padStart(2,"0")} — {school.spots.length} spots</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black leading-tight mb-1">{school.name}</h2>
                  <p className="text-white/70 text-sm font-light">{school.tagline}</p>
                </div>
              </div>
            </div>

            {/* Spots */}
            <div className="space-y-4">
              {school.spots.map((spot, i) => (
                <div key={i} className="tip-card rounded-2xl overflow-hidden relative" style={{background:"#fff",border:`1px solid ${school.border}`}}>
                  {/* Colored left bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{background:school.gradient}}/>
                  {/* Top accent bar */}
                  {i === 0 && <div className="h-[2px]" style={{background:school.gradient}}/>}
                  <div className="p-5 pl-6">
                    <div className="flex items-start gap-3">
                      <span className="text-xl flex-shrink-0 mt-0.5">{spot.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <h3 className="text-base font-black text-slate-900 leading-tight">{spot.name}</h3>
                          <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full" style={{color:school.color,background:school.gradientSoft}}>
                            Spot {String(i + 1).padStart(2,"0")}
                          </span>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed mb-2">{spot.desc}</p>
                        {/* Pro tip */}
                        <div className="flex items-start gap-2 rounded-xl px-3 py-2" style={{background:school.gradientSoft,border:`1px solid ${school.border}`}}>
                          <span className="text-xs font-black uppercase tracking-wider mt-0.5 flex-shrink-0" style={{color:school.color}}>Tip</span>
                          <p className="text-xs leading-relaxed" style={{color:school.color}}>{spot.tip}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Back to top link */}
            <div className="mt-6 text-center">
              <a href="#" className="text-xs font-bold tracking-widest uppercase text-slate-400 hover:text-slate-600 transition-colors">↑ Back to top</a>
            </div>
          </section>
        ))}
      </div>

      {/* CTA */}
      <div className="px-6 pb-20">
        <div className="max-w-3xl mx-auto rounded-2xl p-10 text-center relative overflow-hidden" style={{background:"linear-gradient(135deg,#7c3aed,#db2777,#f59e0b)"}}>
          <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,backgroundSize:"28px 28px"}}/>
          <div className="absolute top-4 right-6 opacity-15 pointer-events-none"><svg width="50" height="80" viewBox="0 0 50 80" fill="none"><path d="M25 4 C38 16,12 28,25 44 C38 60,12 70,25 78" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
          <h3 className="relative text-3xl font-black text-white mb-2 tracking-tight">Know your spots.<br/>Now book the shoot.</h3>
          <p className="relative text-white/75 mb-7 text-sm font-light">Tell me which locations you want and we'll plan the whole session around them.</p>
          <a href="https://www.soloxsnaps.com/contact/" className="btn-lift relative inline-block px-8 py-3 rounded-full bg-white font-bold text-sm" style={{color:"#7c3aed"}}>Book your shoot →</a>
        </div>
      </div>

      <footer className="border-t border-black/[0.06] bg-white py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg" style={{background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Chris.</span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>
    </div>
  );
}