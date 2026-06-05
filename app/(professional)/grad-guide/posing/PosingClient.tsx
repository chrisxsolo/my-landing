"use client";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GRAD_GUIDE_CSS, GG_SQUIGGLE_PATH } from "@/lib/gradGuide";

type Pose = { id: number; title: string; image_url: string; instructions: string; order: number };

const DRAFT_POSES: Pose[] = [
  { id: 1, title: "Hand on Hip, Hand on Stool", image_url: "", instructions: "Place one hand on your hip and rest the other on a stool, ledge, or wall. This breaks up stiff posture and gives you something natural to do with your hands. Shift your weight to one leg slightly — it creates a relaxed S-curve that photographs beautifully.", order: 1 },
  { id: 2, title: "Cap in the Air", image_url: "", instructions: "Hold your graduation cap above your head with both hands, arms extended, and look up at it with a genuine smile. The key is to actually laugh or think of something funny — forced smiles read flat on camera. Toss it slightly and catch it mid-air for a more dynamic version.", order: 2 },
  { id: 3, title: "Walking Toward Camera", image_url: "", instructions: "Walk naturally toward the camera with your cap and gown flowing. Look just slightly past the lens and let your expression be relaxed. This shot works best in an open walkway or path with leading lines.", order: 3 },
  { id: 4, title: "Leaning Against a Wall", image_url: "", instructions: "Stand with your back or shoulder against a wall, one foot flat against it. Cross your arms loosely or hold your diploma in one hand. Tilt your chin down slightly and look into the camera.", order: 4 },
  { id: 5, title: "Sitting on Steps", image_url: "", instructions: "Find a set of stairs and sit naturally — slightly leaning forward with elbows on your knees. Spread your gown out around you for visual impact. Great for outdoor campus steps or urban staircases.", order: 5 },
  { id: 6, title: "Looking Away, Candid Profile", image_url: "", instructions: "Look off into the distance at a 45-degree angle from the camera. Think about something that makes you genuinely happy. This works best in golden hour light where the sun hits the side of your face.", order: 6 },
];

const MARQUEE = ["Pose Guide", "Study Before Shoot", "Natural Light", "Real Moments", "No Stiff Poses", "Bay Area Grads"];
const marquee = [...MARQUEE, ...MARQUEE];

export default function PosingClient() {
  const [poses, setPoses] = useState<Pose[]>(DRAFT_POSES);

  useEffect(() => {
    async function fetchPoses() {
      try {
        const { data, error } = await supabase.from("grad_poses").select("*").order("order", { ascending: true });
        if (error) console.error(error);
        if (data && data.length > 0) setPoses(data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchPoses();
  }, []);

  return (
    <main className="gg-page">
      <style>{GRAD_GUIDE_CSS}</style>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="gg-hero">
        <span className="gg-hero-corner" style={{ top: 18, left: 18, borderTop: "2px solid rgba(112,139,133,0.32)", borderLeft: "2px solid rgba(112,139,133,0.32)" }} />
        <span className="gg-hero-corner" style={{ bottom: 18, right: 18, borderBottom: "2px solid rgba(112,139,133,0.32)", borderRight: "2px solid rgba(112,139,133,0.32)" }} />
        <span className="gg-dot" style={{ position: "absolute", top: 28, right: 30, width: 8, height: 8, borderRadius: 999, background: "#5b8a7a" }} />
        <div className="gg-hero-squiggle gg-float">
          <svg width="100" height="200" viewBox="0 0 100 200" fill="none">
            <path className="gg-sq" d={GG_SQUIGGLE_PATH} stroke="#5b8a7a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="gg-shell" style={{ position: "relative", zIndex: 1 }}>
          <p className="gg-kicker gg-afu1"><span className="gg-kicker-dot gg-dot" /> 01 — Posing Guide</p>
          <h1 className="gg-h1 gg-afu2">Poses that actually</h1>
          <p className="gg-h1-script gg-afu3"><span className="gg-h1-accent">look good.</span><span className="gg-cursor gg-blink" /></p>
          <p className="gg-sub gg-afu4">No stiff yearbook poses here. These are natural, flattering positions that work for real people — not just models. Study them before your shoot and we&rsquo;ll nail every single one.</p>
        </div>
      </section>

      {/* ── MARQUEE ────────────────────────────────────────────────────────── */}
      <div className="gg-marquee">
        <div className="gg-marquee-track">
          {marquee.map((item, i) => (
            <span key={i} className="gg-marquee-item">{item}<span className="gg-marquee-sep" /></span>
          ))}
        </div>
      </div>

      {/* ── POSES ──────────────────────────────────────────────────────────── */}
      <section className="gg-section">
        <div className="gg-shell">
          <div className="gg-poses">
            {poses.map((pose, index) => (
              <article key={pose.id} className="gg-pose" data-reveal>
                <span className="gg-pose-bar" />
                <div className="gg-pose-grid">
                  <div className="gg-pose-media">
                    {pose.image_url ? (
                      <img src={pose.image_url} alt={pose.title} loading="lazy" decoding="async" />
                    ) : (
                      <div className="gg-pose-placeholder"><span>📷</span><p>Photo via Supabase</p></div>
                    )}
                  </div>
                  <div className="gg-pose-body">
                    <span className="gg-badge">POSE {String(index + 1).padStart(2, "0")}</span>
                    <h2 className="gg-pose-title">{pose.title}</h2>
                    <p className="gg-pose-text">{pose.instructions}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="gg-cta">
        <div className="gg-shell">
          <div className="gg-cta-card glass-shimmer" data-reveal>
            <div className="gg-cta-squiggle">
              <svg width="50" height="80" viewBox="0 0 50 80" fill="none"><path d="M25 4 C38 16,12 28,25 44 C38 60,12 70,25 78" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
            </div>
            <h2 className="gg-cta-title">Ready to shoot?</h2>
            <p className="gg-cta-sub">Save these poses on your phone so you can reference them day-of.</p>
            <div className="gg-cta-actions">
              <Link href="/grad-guide/what-to-wear" className="gg-btn gg-btn--ongreen">Next: What to Wear →</Link>
              <Link href="/contact?school=Graduation" className="gg-btn gg-btn--onghost">Book a shoot</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
