"use client";

import { Dispatch, SetStateAction } from "react";
import { C } from "@/lib/colors";
import {
  GRAD_LOCATION_OPTIONS,
  GRAD_SCHOOL_OPTIONS,
  GRAD_SESSION_OPTIONS,
  GRAD_DEGREE_OPTIONS,
  GRAD_YEAR_OPTIONS,
  GRAD_ATTIRE_OPTIONS,
  buildPortfolioSeoDescription,
  type GradLocationOption,
  type GradSchoolOption,
  type GradSessionOption,
  type GradDegreeOption,
  type GradYearOption,
  type GradAttireOption,
} from "@/lib/portfolioSeoDescription";

export type PortfolioSeoDraft = {
  school: GradSchoolOption | null;
  location: GradLocationOption | null;
  session: GradSessionOption | null;
  degree: GradDegreeOption | null;
  year: GradYearOption | null;
  attire: GradAttireOption | null;
  goldenHour: boolean;
};

type Props = {
  draft: PortfolioSeoDraft;
  setDraft: Dispatch<SetStateAction<PortfolioSeoDraft>>;
  heading: string;
  subheading: string;
  saveLabel: string;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
};

export default function PortfolioSeoPanel({ draft, setDraft, heading, subheading, saveLabel, saving, onSave, onClose }: Props) {
  const preview = buildPortfolioSeoDescription(draft);
  return (
    <div className="border-t border-slate-100 p-4 bg-slate-50">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-700">{heading}</p>
          <p className="text-xs text-slate-400 mt-1">{subheading}</p>
        </div>
        <button onClick={onClose} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white text-slate-500 border border-slate-200">Close</button>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">School</p>
          <div className="flex flex-wrap gap-1.5">
            {GRAD_SCHOOL_OPTIONS.map(school=>(
              <button key={school} onClick={()=>setDraft(d=>({...d,school:d.school===school?null:school}))}
                className="text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors"
                style={draft.school===school?{background:C.ink,color:C.white,borderColor:C.ink}:{background:C.white,color:C.inkSoft,borderColor:C.borderSubtle}}>
                {school}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Location</p>
          <div className="flex flex-wrap gap-1.5">
            {GRAD_LOCATION_OPTIONS.map(location=>(
              <button key={location} onClick={()=>setDraft(d=>({...d,location:d.location===location?null:location}))}
                className="text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors"
                style={draft.location===location?{background:C.p1,color:C.white,borderColor:C.p1}:{background:C.white,color:C.inkSoft,borderColor:C.borderSubtle}}>
                {location}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Session</p>
          <div className="flex flex-wrap gap-1.5">
            {GRAD_SESSION_OPTIONS.map(session=>(
              <button key={session} onClick={()=>setDraft(d=>({...d,session:d.session===session?null:session}))}
                className="text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors"
                style={draft.session===session?{background:C.p2,color:C.white,borderColor:C.p2}:{background:C.white,color:C.inkSoft,borderColor:C.borderSubtle}}>
                {session}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Degree</p>
          <div className="flex flex-wrap gap-1.5">
            {GRAD_DEGREE_OPTIONS.map(degree=>(
              <button key={degree} onClick={()=>setDraft(d=>({...d,degree:d.degree===degree?null:degree}))}
                className="text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors"
                style={draft.degree===degree?{background:C.p2,color:C.white,borderColor:C.p2}:{background:C.white,color:C.inkSoft,borderColor:C.borderSubtle}}>
                {degree}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Class year</p>
          <div className="flex flex-wrap gap-1.5">
            {GRAD_YEAR_OPTIONS.map(year=>(
              <button key={year} onClick={()=>setDraft(d=>({...d,year:d.year===year?null:year}))}
                className="text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors"
                style={draft.year===year?{background:C.p2,color:C.white,borderColor:C.p2}:{background:C.white,color:C.inkSoft,borderColor:C.borderSubtle}}>
                {year}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Attire</p>
          <div className="flex flex-wrap gap-1.5">
            {GRAD_ATTIRE_OPTIONS.map(attire=>(
              <button key={attire} onClick={()=>setDraft(d=>({...d,attire:d.attire===attire?null:attire}))}
                className="text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors"
                style={draft.attire===attire?{background:C.p2,color:C.white,borderColor:C.p2}:{background:C.white,color:C.inkSoft,borderColor:C.borderSubtle}}>
                {attire}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={()=>setDraft(d=>({...d,goldenHour:!d.goldenHour}))}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors"
            style={draft.goldenHour?{background:C.p3,color:C.ink,borderColor:C.p3}:{background:C.white,color:C.inkSoft,borderColor:C.borderSubtle}}>
            {draft.goldenHour?"Golden hour ✓":"Golden hour"}
          </button>
          <div className="flex-1 min-w-[220px] rounded-xl bg-white border border-slate-100 px-3 py-2">
            <p className="text-xs font-black text-slate-800 truncate">{preview.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{preview.alt}</p>
          </div>
        </div>
        <button onClick={onSave} disabled={saving}
          className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95"
          style={{background:C.grad12,opacity:saving?0.7:1}}>
          {saving?"Saving description…":saveLabel}
        </button>
      </div>
    </div>
  );
}
