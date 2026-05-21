import { useState } from 'react';
import { jdApi } from '../../lib/api';

const G='#00C982',GD='#009963';
const Btn=({onClick,disabled,children,outline})=>(
  <button onClick={onClick} disabled={disabled} style={{padding:'9px 18px',borderRadius:9,border:outline?'1px solid #E5E7EB':'none',background:disabled?'#E5E7EB':outline?'white':'linear-gradient(135deg,#00C982,#009963)',color:disabled?'#9CA3AF':outline?'#374151':'white',fontSize:13,fontWeight:700,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit'}}>{children}</button>
);

export default function JDStep({ onComplete, onBack }) {
  const [text,    setText]   = useState('');
  const [loading, setLoading]= useState(false);
  const [error,   setError]  = useState('');
  const [parsed,  setParsed] = useState(null);

  const handle = async () => {
    if (!text.trim()||text.length<30) { setError('Paste a job description (30+ chars)'); return; }
    setError(''); setLoading(true);
    try {
      const res = await jdApi.parse(text);
      setParsed(res.data);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const card = { background:'white', borderRadius:14, padding:'20px 22px', border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.05)', marginBottom:16 };

  return (
    <div style={card}>
      <div style={{fontSize:18,fontWeight:800,color:'#0D1B2A',margin:'0 0 4px',letterSpacing:'-.3px'}}>Paste job description</div>
      <div style={{fontSize:13,color:'#6B7280',margin:'0 0 16px',lineHeight:1.6}}>Claude extracts required skills, preferred skills, years required, and key responsibilities.</div>

      <textarea value={text} onChange={e=>{setText(e.target.value);setParsed(null);}} rows={10} placeholder="Paste the full job description here..."
        style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'2px solid #E5E7EB',fontSize:12,resize:'vertical',outline:'none',color:'#374151',lineHeight:1.5,marginBottom:12,boxSizing:'border-box'}}/>

      {error&&<div style={{padding:'10px 13px',background:'#FEE2E2',border:'1px solid #FCA5A5',borderRadius:9,fontSize:12,color:'#991B1B',marginBottom:12}}>{error}</div>}

      <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
        <Btn onClick={onBack} outline>Back</Btn>
        <Btn onClick={handle} disabled={loading||!text.trim()}>{loading?'Parsing JD...':'Parse JD ->'}</Btn>
      </div>

      {parsed&&(
        <div style={{animation:'fadeIn .2s ease'}}>
          <div style={{background:'#F9FAFB',borderRadius:12,padding:'16px',border:'1px solid #F3F4F6',marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
              <div style={{width:40,height:40,borderRadius:11,background:'linear-gradient(135deg,#3B82F6,#06B6D4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'white'}}></div>
              <div>
                <div style={{fontWeight:700,color:'#0D1B2A',fontSize:14}}>{parsed.title||'Role'}</div>
                {parsed.company&&<div style={{fontSize:11,color:'#6B7280'}}>{parsed.company}</div>}
              </div>
              {parsed.yearsRequired>0&&<span style={{marginLeft:'auto',padding:'3px 9px',borderRadius:20,background:'#EDE9FE',color:'#7C3AED',fontSize:11,fontWeight:700}}>{parsed.yearsRequired}+ yrs required</span>}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:7}}>Required skills</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {(parsed.required||[]).map(s=><span key={s} style={{padding:'2px 8px',borderRadius:20,background:'#FEE2E2',color:'#991B1B',fontSize:11,fontWeight:600}}>{s}</span>)}
                </div>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:7}}>Preferred skills</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {(parsed.preferred||[]).map(s=><span key={s} style={{padding:'2px 8px',borderRadius:20,background:'#DBEAFE',color:'#1D4ED8',fontSize:11,fontWeight:600}}>{s}</span>)}
                </div>
              </div>
            </div>
            {(parsed.responsibilities||[]).length>0&&(
              <div style={{marginTop:12}}>
                <div style={{fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6}}>Key Responsibilities</div>
                {parsed.responsibilities.slice(0,4).map((r,i)=>(
                  <div key={i} style={{fontSize:11,color:'#374151',display:'flex',gap:7,marginBottom:4}}>
                    <span style={{color:G,flexShrink:0}}>></span>{r}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <Btn onClick={onBack} outline>Back</Btn>
            <Btn onClick={()=>onComplete(parsed,text)}>Run AI analysis  </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
