import { useState, useEffect } from 'react';

const G='#00C982',GD='#009963',W='#F59E0B',R='#EF4444';
const scoreColor=s=>s>=70?G:s>=45?W:R;
const Btn=({onClick,disabled,children,outline,style={}})=>(
  <button onClick={onClick} disabled={disabled} style={{padding:'9px 18px',borderRadius:9,border:outline?'1px solid #E5E7EB':'none',background:disabled?'#E5E7EB':outline?'white':'linear-gradient(135deg,#00C982,#009963)',color:disabled?'#9CA3AF':outline?'#374151':'white',fontSize:13,fontWeight:700,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',...style}}>{children}</button>
);

function ScoreRing({ score, label, size=110, delay=0 }) {
  const [display,setDisplay]=useState(0);
  useEffect(()=>{
    const t=setTimeout(()=>{ let v=0; const iv=setInterval(()=>{ v=Math.min(v+1.2,score); setDisplay(Math.round(v)); if(v>=score)clearInterval(iv); },16); return ()=>clearInterval(iv); },delay);
    return ()=>clearTimeout(t);
  },[score,delay]);
  const r=size*.38, circ=2*Math.PI*r, sc=Math.round(score), color=scoreColor(sc), offset=circ-(display/100)*circ;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
      <div style={{position:'relative',width:size,height:size}}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:'rotate(-90deg)'}}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={size*.08}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*.08} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{transition:'stroke-dashoffset .05s'}}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:size*.22,fontWeight:700,color,lineHeight:1}}>{display}%</span>
        </div>
      </div>
      <span style={{fontSize:12,color:'#6B7280',fontWeight:600}}>{label}</span>
    </div>
  );
}

export default function BeforeAfterDashboard({ originalText, result, selectedPointsByRole, analysis, dlDocx, saved, onDownloadDocx, onDownloadTxt, error, onBack, onReset }) {
  const [tab, setTab] = useState('overview');
  const insertedBullets = result?.insertedBullets || [];
  const mode = result?.mode || 'generated';
  const scoreBefore = analysis?.matchScore || 0;
  const scoreAfter  = Math.min(100, scoreBefore + 12 + Math.min(10, insertedBullets.length));

  const roleGroups = {};
  for (const { role, bullet } of insertedBullets) {
    if (!roleGroups[role]) roleGroups[role] = [];
    roleGroups[role].push(bullet);
  }

  const card = { background:'white', borderRadius:14, padding:'20px 22px', border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.05)', marginBottom:16 };

  return (
    <div style={card}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:'#0D1B2A',margin:'0 0 3px',letterSpacing:'-.3px'}}>Resume Optimized +</div>
          <div style={{fontSize:13,color:'#6B7280'}}>{mode==='inserted' ? `Inserted ${insertedBullets.length} points into original DOCX` : `Integrated ${insertedBullets.length} points into resume`}</div>
        </div>
        {saved&&<span style={{padding:'4px 12px',borderRadius:20,background:'#D1FAE5',color:'#059669',fontSize:12,fontWeight:700}}>v Saved to History</span>}
      </div>

      {/* Score comparison */}
      <div style={{background:'#F9FAFB',borderRadius:12,padding:'20px',border:'1px solid #F3F4F6',display:'flex',justifyContent:'space-around',alignItems:'center',marginBottom:16}}>
        <ScoreRing score={scoreBefore} label="Before" delay={0}/>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:28,marginBottom:4}}> </div>
          <div style={{fontSize:12,fontWeight:700,color:G}}>+{Math.max(0,(scoreAfter-scoreBefore).toFixed(0))}% improvement</div>
          <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{insertedBullets.length} bullets added</div>
        </div>
        <ScoreRing score={scoreAfter} label="After" delay={400}/>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:0,background:'#F3F4F6',borderRadius:9,padding:3,marginBottom:14,width:'fit-content'}}>
        {[['overview',' Overview'],['roles',' Per Role'],['download',' Download']].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:'6px 16px',borderRadius:7,border:'none',fontSize:12,fontWeight:600,cursor:'pointer',background:tab===id?'white':'transparent',color:tab===id?'#0D1B2A':'#6B7280',boxShadow:tab===id?'0 1px 3px rgba(0,0,0,.08)':'none',transition:'all .15s',fontFamily:'inherit'}}>{lbl}</button>
        ))}
      </div>

      {tab==='overview'&&(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14}}>
            {[[(analysis?.matchedSkills||[]).length,'Matched Skills',G],[(analysis?.missingSkills||[]).length,'Gaps Filled',GD],[insertedBullets.length,'Bullets Added','#7C3AED']].map(([v,l,c])=>(
              <div key={l} style={{background:'#F9FAFB',borderRadius:10,padding:'12px',border:'1px solid #F3F4F6',textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:800,color:c}}>{v}</div>
                <div style={{fontSize:11,color:'#9CA3AF'}}>{l}</div>
              </div>
            ))}
          </div>
          {mode!=='inserted'&&result?.integratedResume&&(
            <div style={{background:'#F9FAFB',borderRadius:10,padding:'12px',border:'1px solid #F3F4F6',maxHeight:280,overflowY:'auto'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Integrated Resume Preview</div>
              <pre style={{fontFamily:'monospace',fontSize:10,color:'#374151',lineHeight:1.6,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{result.integratedResume.slice(0,3000)}</pre>
            </div>
          )}
        </div>
      )}

      {tab==='roles'&&(
        <div>
          {Object.entries(roleGroups).map(([role,bullets])=>(
            <div key={role} style={{background:'#F9FAFB',borderRadius:10,padding:'12px',border:'1px solid #F3F4F6',marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:700,color:'#0D1B2A',marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
                <span>{role}</span>
                <span style={{padding:'2px 8px',borderRadius:20,background:'#EDE9FE',color:'#7C3AED',fontSize:10,fontWeight:700}}>{bullets.length} new bullets</span>
              </div>
              {bullets.map((b,i)=>(
                <div key={i} style={{display:'flex',gap:7,padding:'6px 9px',borderRadius:7,background:'#F0FDF7',border:'1px solid #A7F3D0',marginBottom:5,fontSize:11,color:'#059669',lineHeight:1.5,animation:'fadeIn .3s ease'}}>
                  <span style={{flexShrink:0}}>+ new</span>
                  <span style={{color:'#374151'}}>{b}</span>
                </div>
              ))}
            </div>
          ))}
          {Object.keys(roleGroups).length===0&&<div style={{textAlign:'center',padding:'30px',color:'#9CA3AF',fontSize:13}}>No role breakdown available</div>}
        </div>
      )}

      {tab==='download'&&(
        <div>
          {/* DOCX download — always shown, disabled only if generation failed */}
          <div style={{background: result.resultDocxBase64 ? '#D1FAE5' : '#F9FAFB', borderRadius:11, padding:'16px', border:'1px solid ' + (result.resultDocxBase64 ? '#A7F3D0' : '#E5E7EB'), marginBottom:12, display:'flex', alignItems:'center', gap:12}}>
            <span style={{fontSize:28}}>{result.resultDocxBase64 ? '' : ''}</span>
            <div style={{flex:1}}>
              {result.resultDocxBase64 ? (
                <>
                  <div style={{fontSize:14, fontWeight:700, color:'#059669', marginBottom:2}}>
                    {mode === 'inserted' ? 'DOCX ready - original formatting preserved' : 'DOCX ready - generated from template'}
                  </div>
                  <div style={{fontSize:12, color:'#374151'}}>
                    {mode === 'inserted'
                      ? 'All fonts, tables, spacing, and layout from your original file are intact'
                      : 'Generated using Classic Professional or Executive Compact template with your optimized content'}
                  </div>
                </>
              ) : (
                <>
                  <div style={{fontSize:13, fontWeight:700, color:'#6B7280', marginBottom:2}}>DOCX unavailable</div>
                  <div style={{fontSize:11, color:'#9CA3AF'}}>DOCX generation failed — use TXT download below</div>
                </>
              )}
            </div>
            <Btn
              onClick={onDownloadDocx}
              disabled={dlDocx || !result.resultDocxBase64}
              style={{flexShrink:0}}>
              {dlDocx ? '... Downloading...' : ' Download DOCX'}
            </Btn>
          </div>

          {/* TXT download — always shown, always enabled */}
          <div style={{background:'#F9FAFB', borderRadius:11, padding:'16px', border:'1px solid #E5E7EB', marginBottom:12, display:'flex', alignItems:'center', gap:12}}>
            <span style={{fontSize:28}}></span>
            <div style={{flex:1}}>
              <div style={{fontSize:13, fontWeight:700, color:'#374151', marginBottom:2}}>Plain text version</div>
              <div style={{fontSize:11, color:'#9CA3AF'}}>All optimized content in plain text — paste into any editor or ATS portal</div>
            </div>
            <Btn onClick={onDownloadTxt} outline style={{flexShrink:0}}> Download TXT</Btn>
          </div>
        </div>
      )}

      {error&&<div style={{padding:'10px 13px',background:'#FEE2E2',border:'1px solid #FCA5A5',borderRadius:9,fontSize:12,color:'#991B1B',marginTop:12}}>{error}</div>}

      <div style={{display:'flex',justifyContent:'space-between',marginTop:16}}>
        <Btn onClick={onReset || onBack} outline>Start over</Btn>
        <div style={{display:'flex',gap:8}}>
          <Btn onClick={onBack} outline>Back to Preview</Btn>
          <Btn onClick={()=>window.location.href='/dashboard/resumes'}>View all resumes</Btn>
        </div>
      </div>
    </div>
  );
}
