import { useState } from 'react';

const G='#00C982',GD='#009963',W='#F59E0B',R='#EF4444';
const scoreColor = s => s>=70?G:s>=45?W:R;

function ArcScore({ score, label, color }) {
  const r=26, circ=2*Math.PI*r, pct=Math.min(100,Math.max(0,score||0));
  const offset=circ-(pct/100)*circ;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <div style={{position:'relative',width:64,height:64}}>
        <svg width="64" height="64" viewBox="0 0 64 64" style={{transform:'rotate(-90deg)'}}>
          <circle cx="32" cy="32" r={r} fill="none" stroke="#F3F4F6" strokeWidth="6"/>
          <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{transition:'stroke-dashoffset 1s ease'}}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:13,fontWeight:700,color:'#0D1B2A'}}>{pct}</span>
        </div>
      </div>
      <span style={{fontSize:10,color:'#9CA3AF',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',textAlign:'center'}}>{label}</span>
    </div>
  );
}

function DurationBar({ dates, maxMonths }) {
  const toMonths = d => {
    if (!d) return 0;
    const parts = d.split(/\s*[--]\s*/);
    const parse = s => { if(!s)return null; const n=s.toLowerCase().trim(); if(/present|current|now/.test(n))return new Date(); const y=n.match(/\b(19|20)\d{2}\b/); if(!y)return null; const ms=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']; let m=0; for(let i=0;i<ms.length;i++)if(n.includes(ms[i])){m=i;break;} return new Date(+y[0],m); };
    const start=parse(parts[0]), end=parse(parts[1])||new Date();
    if(!start||!end)return 0;
    return Math.max(0,(end.getFullYear()-start.getFullYear())*12+end.getMonth()-start.getMonth());
  };
  const months = toMonths(dates);
  const pct    = maxMonths>0?(months/maxMonths)*100:0;
  const label  = months>=12?`${Math.floor(months/12)}y${months%12>0?` ${months%12}mo`:''}` : `${months}mo`;
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,width:'100%'}}>
      <div style={{flex:1,height:5,background:'#F3F4F6',borderRadius:99,overflow:'hidden'}}>
        <div style={{width:`${pct}%`,height:'100%',background:G,borderRadius:99,transition:'width 1s ease'}}/>
      </div>
      <span style={{fontSize:10,color:'#9CA3AF',minWidth:40,textAlign:'right'}}>{label}</span>
    </div>
  );
}

export default function ResumeDashboard({ parsed }) {
  const [showAll, setShowAll] = useState(false);
  if (!parsed) return null;
  const exps   = parsed.experiences || [];
  const skills = parsed.skills || [];
  const maxMo  = Math.max(...exps.map(e=>{const parts=(e.dates||'').split(/\s*[--]\s*/);const parse=s=>{if(!s)return null;const n=s.toLowerCase().trim();if(/present|current|now/.test(n))return new Date();const y=n.match(/\b(19|20)\d{2}\b/);if(!y)return null;return new Date(+y[0],0);};const s=parse(parts[0]),en=parse(parts[1])||new Date();if(!s||!en)return 0;return Math.max(0,(en.getFullYear()-s.getFullYear())*12+en.getMonth()-s.getMonth());}),1);
  const summary  = parsed.summary && parsed.summary.split(' ').length>8 ? 85 : 45;
  const skillsS  = Math.min(100,((skills.length)/15)*100);
  const expS     = Math.min(100,(exps.length/5)*100);
  const eduS     = parsed.education && parsed.education.length>5 ? 90 : 40;
  const atsScore = Math.round((summary+skillsS+expS+eduS)/4);
  const displayExps = showAll ? exps : exps.slice(0,4);

  return (
    <div style={{marginTop:'1.25rem',display:'flex',flexDirection:'column',gap:'0.75rem'}}>
      {/* Identity */}
      <div style={{background:'#F9FAFB',borderRadius:12,padding:'14px 16px',border:'1px solid #F3F4F6',display:'flex',alignItems:'flex-start',gap:'1rem'}}>
        <div style={{width:48,height:48,borderRadius:14,flexShrink:0,background:`linear-gradient(135deg,${G},${GD})`,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:18,fontWeight:700}}>
          {(parsed.name||'U')[0]}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15,color:'#0D1B2A'}}>{parsed.name||'Candidate'}</div>
          <div style={{fontSize:13,color:G,marginTop:2}}>{parsed.title||''}</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:12,marginTop:6,fontSize:11,color:'#6B7280'}}>
            {parsed.email && <span> {parsed.email}</span>}
            {parsed.phone && <span> {parsed.phone}</span>}
            {parsed.location && <span> {parsed.location}</span>}
          </div>
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          <div style={{fontSize:24,fontWeight:800,color:GD}}>{parsed.years||'?'}y</div>
          <div style={{fontSize:10,color:'#9CA3AF'}}>total exp</div>
        </div>
      </div>

      {/* Section health */}
      <div style={{background:'#F9FAFB',borderRadius:12,padding:'14px 16px',border:'1px solid #F3F4F6'}}>
        <div style={{fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:12}}>Resume Section Health</div>
        <div style={{display:'flex',justifyContent:'space-around',alignItems:'flex-start'}}>
          <ArcScore score={Math.round(summary)} label="Summary" color="#7C3AED"/>
          <ArcScore score={Math.round(skillsS)} label="Skills" color={G}/>
          <ArcScore score={Math.round(expS)}    label="Experience" color={W}/>
          <ArcScore score={Math.round(eduS)}    label="Education" color="#A855F7"/>
          <ArcScore score={atsScore}            label="ATS Ready" color={scoreColor(atsScore)}/>
        </div>
      </div>

      {/* Experience timeline */}
      <div style={{background:'#F9FAFB',borderRadius:12,padding:'14px 16px',border:'1px solid #F3F4F6'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.5px'}}>Experience - {exps.length} roles</div>
          {exps.length>4&&<button onClick={()=>setShowAll(s=>!s)} style={{fontSize:11,color:G,fontWeight:700,border:`1px solid ${G}`,background:'white',borderRadius:7,padding:'3px 9px',cursor:'pointer'}}>{showAll?'Show less':`+${exps.length-4} more`}</button>}
        </div>
        {displayExps.map((exp,i)=>(
          <div key={i} style={{display:'flex',gap:12,marginBottom:10,paddingBottom:10,borderBottom:i<displayExps.length-1?'1px solid #F3F4F6':'none'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:G,flexShrink:0,marginTop:6}}/>
            <div style={{flex:1}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:4}}>
                <div>
                  <div style={{fontWeight:600,fontSize:13,color:'#0D1B2A'}}>{exp.role||'Not specified'}</div>
                  <div style={{fontSize:11,color:G,fontWeight:500}}>{exp.company}</div>
                  {exp.client&&exp.client!==exp.company&&<div style={{fontSize:10,color:'#9CA3AF'}}>Client: {exp.client}</div>}
                </div>
                <span style={{padding:'2px 8px',borderRadius:20,background:'#F3F4F6',color:'#6B7280',fontSize:10,fontWeight:600,flexShrink:0}}>{exp.dates||'N/A'}</span>
              </div>
              <DurationBar dates={exp.dates} maxMonths={maxMo}/>
            </div>
          </div>
        ))}
      </div>

      {/* Skills */}
      {skills.length>0&&(
        <div style={{background:'#F9FAFB',borderRadius:12,padding:'14px 16px',border:'1px solid #F3F4F6'}}>
          <div style={{fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Skills Detected ({skills.length})</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
            {skills.map(s=><span key={s} style={{padding:'3px 9px',borderRadius:20,background:'#EDE9FE',color:'#7C3AED',fontSize:11,fontWeight:600}}>{s}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
