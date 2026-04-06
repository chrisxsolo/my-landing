// lib/guidestyles.ts — shared animation + decoration styles for all grad-guide pages
// Import this into each page: import { GUIDE_STYLES } from "@/lib/guidestyles"

export const GUIDE_STYLES = `
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  @keyframes blobFloat{0%,100%{transform:translate(0,0)scale(1);}33%{transform:translate(14px,-10px)scale(1.02);}66%{transform:translate(-10px,12px)scale(0.98);}}
  @keyframes blobFloat2{0%,100%{transform:translate(0,0)scale(1);}33%{transform:translate(-12px,8px)scale(0.97);}66%{transform:translate(10px,-8px)scale(1.03);}}
  @keyframes drawLine{from{stroke-dashoffset:320;}to{stroke-dashoffset:0;}}
  @keyframes marquee{from{transform:translateX(0);}to{transform:translateX(-50%);}}
  @keyframes pulseRing{0%,100%{opacity:0.5;transform:scale(1);}50%{opacity:0.15;transform:scale(1.25);}}
  @keyframes cursorBlink{0%,100%{opacity:1;}50%{opacity:0;}}
  @keyframes spinSlow{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
  @keyframes floatY{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
  .afu1{animation:fadeUp 0.55s 0.05s ease both;}
  .afu2{animation:fadeUp 0.55s 0.13s ease both;}
  .afu3{animation:fadeUp 0.55s 0.21s ease both;}
  .afu4{animation:fadeUp 0.55s 0.29s ease both;}
  .af{animation:fadeIn 0.6s ease both;}
  .blob1{animation:blobFloat 10s ease-in-out infinite;}
  .blob2{animation:blobFloat2 13s ease-in-out infinite;}
  .sqp1{stroke-dasharray:320;stroke-dashoffset:320;animation:drawLine 2.2s 0.7s ease forwards;}
  .sqp2{stroke-dasharray:300;stroke-dashoffset:300;animation:drawLine 2.4s 0.9s ease forwards;}
  .sqp3{stroke-dasharray:280;stroke-dashoffset:280;animation:drawLine 2.6s 1.1s ease forwards;}
  .mtrack{animation:marquee 22s linear infinite;}
  .cblink{animation:cursorBlink 1.1s step-end infinite;}
  .pdot{animation:pulseRing 2.5s ease-in-out infinite;}
  .spin{animation:spinSlow 12s linear infinite;}
  .floaty{animation:floatY 4s ease-in-out infinite;}
  .card-lift{transition:transform 0.22s ease,box-shadow 0.22s ease;}
  .card-lift:hover{transform:translateY(-5px);box-shadow:0 20px 48px rgba(124,58,237,0.13);}
  .tip-card{transition:transform 0.2s ease,box-shadow 0.2s ease;}
  .tip-card:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(124,58,237,0.08);}
  .btn-lift{transition:transform 0.18s ease,box-shadow 0.18s ease;}
  .btn-lift:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.14);}
`