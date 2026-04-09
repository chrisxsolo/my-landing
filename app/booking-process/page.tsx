"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { C } from "@/lib/colors";
import GuideNav from "@/app/components/GuideNav";

export const dynamic = 'force-dynamic'

type Step = {
  id: number;
  phase: string;
  title: string;
  description: string;
  emoji: string;
  duration: string;
  details: string[];
  color: string;
  gradient: string;
};

const STEPS: Step[] = [
  {
    id: 1,
    phase: "START",
    title: "Inquire & Book",
    description: "Reach out through the contact form or Instagram DM. We'll discuss your vision, preferred locations, and available dates.",
    emoji: "📧",
    duration: "Day 1",
    details: [
      "Fill out contact form or send DM",
      "We discuss dates, locations, vision",
      "I send you pricing and package options",
    ],
    color: C.p1,
    gradient: C.grad12,
  },
  {
    id: 2,
    phase: "BOOKING",
    title: "Lock It In",
    description: "Once you're ready, I'll send over the invoice and contract. Sign digitally and pay the 50% deposit to secure your date.",
    emoji: "✍️",
    duration: "Day 1-3",
    details: [
      "Receive invoice and contract via email",
      "Sign contract digitally",
      "Pay 50% deposit to lock your date",
    ],
    color: C.p2,
    gradient: C.grad23,
  },
  {
    id: 3,
    phase: "PREP",
    title: "Prepare for the Shoot",
    description: "Study the grad guide, pick your outfit, and get ready. I'll send you a final reminder 2 days before with timing and location details.",
    emoji: "✅",
    duration: "Leading up to shoot",
    details: [
      "Review poses and outfit tips from the grad guide",
      "Confirm exact location and timing",
      "Get your cap, gown, and stole ready",
    ],
    color: C.p3,
    gradient: C.grad321,
  },
  {
    id: 4,
    phase: "SHOOT DAY",
    title: "The Session",
    description: "Show up on time, bring your energy, and we'll make it happen. Sessions typically run 45-60 minutes at 1-2 locations.",
    emoji: "📸",
    duration: "Shoot day",
    details: [
      "Meet at the agreed location",
      "45-60 minute session across 1-2 spots",
      "We nail all the poses you wanted",
    ],
    color: C.p1,
    gradient: C.grad12,
  },
  {
    id: 5,
    phase: "FINAL PAYMENT",
    title: "Pay the Remaining 50%",
    description: "After the shoot, I'll send the second invoice for the remaining balance. Once paid, I'll start editing your photos.",
    emoji: "💳",
    duration: "Within 24 hours after shoot",
    details: [
      "Receive final invoice via email",
      "Pay remaining 50% balance",
      "Editing officially begins",
    ],
    color: C.p2,
    gradient: C.grad23,
  },
  {
    id: 6,
    phase: "EDITING",
    title: "Wait for Your Photos",
    description: "Standard turnaround is 2 weeks. Want them faster? Add expedited editing ($50) for 1-week delivery.",
    emoji: "⏳",
    duration: "2 weeks (or 1 week expedited)",
    details: [
      "I edit, color grade, and perfect every shot",
      "Standard: 2-week turnaround",
      "Expedited: 1-week turnaround (+$50)",
    ],
    color: C.p3,
    gradient: C.grad321,
  },
  {
    id: 7,
    phase: "DELIVERY",
    title: "Receive Your Photos",
    description: "You'll get a private online gallery with all your edited photos in high resolution. Download, share, post — they're yours.",
    emoji: "🎁",
    duration: "Final step",
    details: [
      "Private online gallery link sent via email",
      "Download high-res images instantly",
      "Share, print, post — no restrictions",
    ],
    color: C.p1,
    gradient: C.grad,
  },
];

const MARQUEE = [
  "Professional Process","Clear Timeline","No Surprises","Bay Area Grads","Book With Confidence",
  "Professional Process","Clear Timeline","No Surprises","Bay Area Grads","Book With Confidence",
];

export default function BookingProcessPage() {
  const [activeStep, setActiveStep] = useState(0);
  const observerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observers = observerRefs.current.map((ref, index) => {
      if (!ref) return null;
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveStep(index);
            }
          });
        },
        { threshold: 0.6 }
      );
      observer.observe(ref);
      return observer;
    });

    return () => {
      observers.forEach((observer) => observer?.disconnect());
    };
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes blobFloat{0%,100%{transform:translate(0,0)scale(1);}33%{transform:translate(12px,-8px)scale(1.02);}66%{transform:translate(-8px,10px)scale(0.98);}}
        @keyframes pulseRing{0%,100%{opacity:0.5;transform:scale(1);}50%{opacity:0.15;transform:scale(1.25);}}
        @keyframes marquee{from{transform:translateX(0);}to{transform:translateX(-50%);}}
        @keyframes slideIn{from{transform:translateX(-100px);opacity:0;}to{transform:translateX(0);opacity:1;}}
        @keyframes scaleIn{from{transform:scale(0.8);opacity:0;}to{transform:scale(1);opacity:1;}}
        @keyframes drawLine{from{height:0;}to{height:100%;}}
        
        .afu1{animation:fadeUp 0.5s 0.05s ease both;}
        .afu2{animation:fadeUp 0.5s 0.12s ease both;}
        .afu3{animation:fadeUp 0.5s 0.19s ease both;}
        .blob1{animation:blobFloat 10s ease-in-out infinite;}
        .pdot{animation:pulseRing 2.5s ease-in-out infinite;}
        .mtrack{animation:marquee 26s linear infinite;}
        
        .step-card{
          opacity:1;
          transform:translateY(0);
        }
        .timeline-line{
          position:absolute;
          left:50%;
          top:0;
          width:3px;
          height:0;
          background:linear-gradient(180deg,${C.p1},${C.p2},${C.p3},${C.p1});
          transform:translateX(-50%);
          animation:drawLine 1.5s 0.8s ease-out forwards;
        }
        .timeline-dot{
          transition:all 0.4s ease;
          transform:scale(0.9);
        }
        .timeline-dot.active{
          transform:scale(1.15);
          box-shadow:0 0 0 8px rgba(157,111,232,0.15);
        }
        .step-emoji{
          transition:transform 0.3s ease;
        }
        .step-card:hover .step-emoji{
          transform:scale(1.15) rotate(5deg);
        }
        .btn-lift{
          transition:transform 0.18s ease,box-shadow 0.18s ease;
        }
        .btn-lift:hover{
          transform:translateY(-2px);
          box-shadow:0 8px 24px rgba(0,0,0,0.12);
        }
      `}</style>

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-black/[0.06]" style={{background:"rgba(255,255,255,0.9)"}}>
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-black text-lg tracking-tight" style={C.text}>Chris.</Link>
          <Link href="/" className="text-sm font-bold text-slate-700 hover:text-slate-400 transition-colors">← Back to hub</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden px-6 pt-16 pb-14 border-b border-black/[0.06]">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)`,
          backgroundSize: "30px 30px"
        }}/>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at 50% 50%, transparent 40%, white 85%)"
        }}/>
        <div className="absolute top-5 left-5 w-5 h-5 pointer-events-none" style={{borderTop:`2px solid ${C.p1_30}`,borderLeft:`2px solid ${C.p1_30}`}}/>
        <div className="absolute top-5 right-5 w-5 h-5 pointer-events-none" style={{borderTop:`2px solid ${C.p2_18}`,borderRight:`2px solid ${C.p2_18}`}}/>
        <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{background:C.grad12}}/>
        <div className="blob1 absolute rounded-full pointer-events-none" style={{width:480,height:480,top:-120,left:-100,background:`radial-gradient(circle,${C.p1_08},transparent 60%)`}}/>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="afu1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5" style={{background:C.p1_08,border:`1px solid ${C.p1_20}`}}>
            <div className="pdot w-1.5 h-1.5 rounded-full" style={{background:C.grad12}}/>
            <p className="text-xs font-bold tracking-[0.12em] uppercase" style={{color:C.p1}}>The Booking Process</p>
          </div>
          <h1 className="afu2 text-5xl sm:text-6xl font-black tracking-tight leading-tight text-slate-900 mb-2">
            From inquiry to
          </h1>
          <p className="afu3 text-5xl sm:text-6xl font-light italic tracking-tight text-slate-900 mb-6">
            <span style={C.text}>delivery.</span>
            <span className="inline-block w-[3px] h-[44px] sm:h-[52px] ml-1.5 rounded-sm align-middle" style={{background:C.grad12,animation:"cursorBlink 1.1s step-end infinite"}}/>
          </p>
          <p className="text-lg text-slate-600 font-light leading-relaxed max-w-2xl mx-auto">
            Here's exactly what happens from the moment you reach out to the moment you get your final gallery. No surprises, no hidden steps — just a clear, professional process.
          </p>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden border-b border-black/[0.06] py-3">
        <div className="mtrack flex gap-12 whitespace-nowrap w-max">
          {MARQUEE.map((item,i)=>(
            <span key={i} className="flex items-center gap-3 text-[11px] font-bold tracking-[0.14em] uppercase text-slate-300">
              {item}<span className="w-[4px] h-[4px] rounded-full flex-shrink-0" style={{background:C.grad12}}/>
            </span>
          ))}
        </div>
      </div>

      {/* TIMELINE */}
      <section className="px-6 py-20 relative">
        <div className="max-w-4xl mx-auto relative">
          {/* Vertical connecting line */}
          <div className="timeline-line hidden md:block"/>

          {/* Steps */}
          <div className="space-y-16 md:space-y-24">
            {STEPS.map((step, index) => {
              const isEven = index % 2 === 0;
              const isActive = activeStep === index;
              
              return (
                <div
                  key={step.id}
                  ref={(el) => { observerRefs.current[index] = el; }}
                  className="step-card relative"
                >
                  {/* Desktop layout: alternating left/right */}
                  <div className="hidden md:grid md:grid-cols-2 gap-12 items-center">
                    {/* Left side content (odd indices) */}
                    {!isEven && <div/>}
                    
                    {/* Card */}
                    <div className={`${isEven ? '' : 'md:col-start-2'}`}>
                      <div className="rounded-2xl p-8 relative overflow-hidden" style={{
                        background: `linear-gradient(135deg, ${step.color}0d, ${step.color}06)`,
                        border: `1.5px solid ${step.color}30`
                      }}>
                        {/* Accent bar */}
                        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{background:step.gradient}}/>
                        
                        {/* Phase tag */}
                        <div className="mb-4">
                          <span className="text-xs font-black tracking-[0.15em] uppercase px-2.5 py-1 rounded-full inline-block" style={{
                            background: `${step.color}15`,
                            color: step.color
                          }}>
                            {step.phase} · {step.duration}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex items-start gap-4 mb-5">
                          <div className="step-emoji text-5xl flex-shrink-0">{step.emoji}</div>
                          <div className="flex-1">
                            <h3 className="text-2xl font-black text-slate-900 mb-2 leading-tight">{step.title}</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">{step.description}</p>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-2 pl-[68px]">
                          {step.details.map((detail, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{background:step.color}}/>
                              <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right side content (even indices) */}
                    {isEven && <div/>}
                  </div>

                  {/* Mobile layout: single column */}
                  <div className="md:hidden">
                    <div className="rounded-2xl p-6 relative overflow-hidden" style={{
                      background: `linear-gradient(135deg, ${step.color}0d, ${step.color}06)`,
                      border: `1.5px solid ${step.color}30`
                    }}>
                      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{background:step.gradient}}/>
                      
                      <div className="mb-4">
                        <span className="text-xs font-black tracking-[0.15em] uppercase px-2.5 py-1 rounded-full inline-block" style={{
                          background: `${step.color}15`,
                          color: step.color
                        }}>
                          {step.phase} · {step.duration}
                        </span>
                      </div>

                      <div className="flex items-start gap-3 mb-4">
                        <div className="step-emoji text-4xl flex-shrink-0">{step.emoji}</div>
                        <div className="flex-1">
                          <h3 className="text-xl font-black text-slate-900 mb-1.5 leading-tight">{step.title}</h3>
                          <p className="text-slate-600 text-sm leading-relaxed">{step.description}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {step.details.map((detail, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{background:step.color}}/>
                            <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Center timeline dot (desktop only) */}
                  <div className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className={`timeline-dot w-12 h-12 rounded-full flex items-center justify-center ${isActive ? 'active' : ''}`} style={{
                      background: step.gradient,
                      border: "3px solid white",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.1)"
                    }}>
                      <span className="text-white font-black text-sm">{step.id}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* OPTIONAL ADD-ONS */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3" style={{background:C.p3_08,border:`1px solid ${C.p3_18}`}}>
              <div className="w-1.5 h-1.5 rounded-full" style={{background:C.p3}}/>
              <p className="text-xs font-bold tracking-[0.12em] uppercase" style={{color:C.p3}}>Optional Add-Ons</p>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Want it faster?</h2>
            <p className="text-slate-500 mt-2 text-sm">Speed up delivery for an additional fee.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl p-6 relative overflow-hidden" style={{background:`linear-gradient(135deg,${C.p3_08},${C.p2_06})`,border:`1.5px solid ${C.p3_18}`}}>
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{background:C.grad321}}/>
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl">⚡</span>
                <div>
                  <h3 className="text-lg font-black text-slate-900 mb-1">Expedited Editing</h3>
                  <p className="text-sm text-slate-600 mb-2">Get your photos in 1 week instead of 2.</p>
                  <p className="text-2xl font-black" style={{color:C.p3}}>+$50</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-6 relative overflow-hidden" style={{background:`linear-gradient(135deg,${C.p2_08},${C.p1_06})`,border:`1.5px solid ${C.p2_20}`}}>
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{background:C.grad23}}/>
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl">🎨</span>
                <div>
                  <h3 className="text-lg font-black text-slate-900 mb-1">Extra Edits</h3>
                  <p className="text-sm text-slate-600 mb-2">Need background swaps or heavy retouching? Ask first.</p>
                  <p className="text-sm font-bold text-slate-500">Custom pricing</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="px-6 pb-20">
        <div className="max-w-4xl mx-auto rounded-2xl p-10 text-center relative overflow-hidden" style={{background:C.grad}}>
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`,
            backgroundSize: "24px 24px"
          }}/>
          <div className="absolute top-4 right-6 opacity-15 pointer-events-none">
            <svg width="50" height="80" viewBox="0 0 50 80" fill="none">
              <path d="M25 4 C38 16,12 28,25 44 C38 60,12 70,25 78" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
          </div>
          <h3 className="relative text-3xl font-black text-white mb-2 tracking-tight">Ready to get started?</h3>
          <p className="relative text-white/75 mb-7 text-sm font-light">Book your session and let's make it happen.</p>
          <div className="relative flex flex-wrap justify-center gap-3">
            <a href="https://www.soloxsnaps.com/contact/" className="btn-lift px-7 py-3 rounded-full bg-white font-bold text-sm" style={{color:C.p1}}>
              Book your shoot →
            </a>
            <Link href="/availability" className="btn-lift px-6 py-3 rounded-full font-bold text-sm border border-white/30 text-white hover:bg-white/10 transition-colors">
              Check availability
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <GuideNav />

      <footer className="border-t border-black/[0.06] bg-white py-8 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg" style={C.text}>Chris.</span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>
    </div>
  );
}