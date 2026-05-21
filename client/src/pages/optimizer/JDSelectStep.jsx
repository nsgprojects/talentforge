import { useState, useRef, useCallback } from 'react';
import { jdApi } from '../../lib/api';

const G='#00C982', GD='#009963';

export default function JDSelectStep({ jdPool, loadingPools, prefillJd, onComplete }) {
  const [mode,     setMode]    = useState(prefillJd ? 'prefill' : 'pool');
  const [pasteText,setPaste]   = useState(prefillJd?.raw_text||'');
  const [liveSkills,setLive]   = useState({ required:[], preferred:[], title: prefillJd?.parsed?.title||'' });
  const [parsing,  setParsing] = useState(false);
  const [saving,   setSaving]  = useState(false);
  const [error,    setError]   = useState('');
  const [selectedPool, setSelectedPool] = useState(prefillJd?.id||null);
  const fileRef   = useRef();
  const debounce  = useRef();

  const handleText = useCallback(text => {
    setPaste(text); setError('');
    if (debounce.current) clearTimeout(debounce.current);
    if (text.length<60) { setLive({required:[],preferred:[],title:''}); return; }
    debounce.current = setTimeout(function() {
      jdApi.liveParse(text).then(function(r) { setLive(r.data||{}); }).catch(function() {});
    }, 900);
  }, []);

  const handleFile = async (file) => {
    if (!file) return;
    setSaving(true); setError('');
    try {
      const fd=new FormData(); fd.append('file',file);
      const r=await jdApi.parseFile(fd);
      setPaste(r.rawText||''); setLive(r.data||{}); setMode('paste');
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleAnalyzeAndProceed = async () => {
    if (!pasteText.trim()||pasteText.length<30) { setError('Paste a job description (30+ chars)'); return; }
    setError(''); setParsing(true);
    try {
      const r = await jdApi.parse(pasteText);
      // Try to save it, but continue even if duplicate
      let savedId = null;
      try { const saved=await jdApi.save({raw_text:pasteText,parsed:r.data}); savedId=saved.id; } catch {}
      onComplete({ id:savedId, parsed:r.data, raw_text:pasteText });
    } catch(e) { setError(e.message); }
    finally { setParsing(false); }
  };

  const handleSelectPool = (jd) => {
    setSelectedPool(jd.id);
    onComplete({ id:jd.id, parsed:jd.parsed_json||{}, raw_text:jd.raw_text||'' });
  };

  const card = { background:'white', borderRadius:14, padding:'20px 22px', border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.05)', marginBottom:14 };

  return (
    <div style={card}>
      <div style={{ fontSize:18, fontWeight:800, color:'#0D1B2A', marginBottom:4 }}>Step 1 - Job Description</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>Select from your saved JDs or paste/upload a new one</div>

      {/* Prefill banner */}
      {prefillJd && (
        <div style={{ padding:'10px 13px', background:'#E6FAF2', border:'1px solid #A7F3D0', borderRadius:9, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#059669' }}>Pre-selected: {prefillJd.parsed?.title||'JD'}</div>
            <div style={{ fontSize:11, color:'#374151' }}>{prefillJd.parsed?.company||''} . Click Continue to use this JD</div>
          </div>
          <div style={{ display:'flex', gap:7 }}>
            <button onClick={()=>onComplete({ id:prefillJd.id, parsed:prefillJd.parsed, raw_text:prefillJd.raw_text||'' })}
              style={{ padding:'7px 14px', borderRadius:8, border:'none', background:G, color:'white', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              Use this JD
            </button>
            <button onClick={()=>setMode('pool')} style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', fontSize:12, cursor:'pointer', color:'#374151' }}>Change</button>
          </div>
        </div>
      )}

      {/* Mode tabs */}
      <div style={{ display:'flex', gap:0, background:'#F3F4F6', borderRadius:9, padding:3, marginBottom:14, width:'fit-content' }}>
        {[['pool','Saved JDs'],['paste','Paste / Upload']].map(([id,lbl])=>(
          <button key={id} onClick={()=>setMode(id)} style={{ padding:'6px 16px', borderRadius:7, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', background:mode===id?'white':'transparent', color:mode===id?'#0D1B2A':'#6B7280', fontFamily:'inherit', transition:'all .15s' }}>{lbl}</button>
        ))}
      </div>

      {/* Pool mode */}
      {mode==='pool' && (
        <div>
          {loadingPools && <div style={{ padding:'30px', textAlign:'center', color:'#9CA3AF' }}>Loading your JDs...</div>}
          {!loadingPools && jdPool.length===0 && (
            <div style={{ padding:'20px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>No saved JDs yet. Switch to "Paste / Upload" to add one.</div>
          )}
          <div style={{ maxHeight:340, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
            {jdPool.map(jd=>(
              <div key={jd.id} onClick={()=>handleSelectPool(jd)}
                style={{ padding:'12px', borderRadius:10, border:`1.5px solid ${selectedPool===jd.id?G:'#E5E7EB'}`, background:selectedPool===jd.id?'#F0FDF7':'white', cursor:'pointer', display:'flex', gap:10, alignItems:'center', transition:'all .15s' }}>
                <div style={{ width:36, height:36, borderRadius:9, background:'#0D1B2A', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:14, fontWeight:800, flexShrink:0 }}>
                  {(jd.company||jd.title||'J').charAt(0)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#0D1B2A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{jd.title||'Untitled'}</div>
                  <div style={{ fontSize:11, color:'#9CA3AF' }}>{jd.company} . {jd.experience_req} . {new Date(jd.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
                  <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:3 }}>
                    {(jd.skills_required||[]).slice(0,4).map(s=><span key={s} style={{ padding:'1px 6px', borderRadius:20, background:'#FEE2E2', color:'#991B1B', fontSize:10, fontWeight:600 }}>{s}</span>)}
                  </div>
                </div>
                <span style={{ fontSize:12, color:G, fontWeight:700, flexShrink:0 }}>Use  </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paste/upload mode */}
      {(mode==='paste'||mode==='prefill') && (
        <div>
          <div style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'#374151' }}>
                Paste or upload a job description
                {liveSkills.title&&<span style={{ marginLeft:8, fontSize:11, color:G, fontWeight:600 }}>+ {liveSkills.title}</span>}
              </label>
              <div style={{ display:'flex', gap:6 }}>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display:'none' }} onChange={e=>handleFile(e.target.files[0])}/>
                <button onClick={()=>fileRef.current.click()} disabled={saving}
                  style={{ padding:'5px 11px', borderRadius:7, border:'1px solid #E5E7EB', background:'white', fontSize:11, fontWeight:600, cursor:'pointer', color:'#374151' }}>
                  {saving?'Reading...':' Upload JD file'}
                </button>
              </div>
            </div>
            <textarea value={pasteText} onChange={e=>handleText(e.target.value)} rows={8}
              placeholder="Paste the full job description here..."
              style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:`1.5px solid ${pasteText.length>50?G:'#E5E7EB'}`, fontSize:13, resize:'vertical', outline:'none', color:'#374151', lineHeight:1.5, boxSizing:'border-box', fontFamily:'inherit', transition:'border-color .2s' }}/>
            {(liveSkills.required||[]).length>0 && (
              <div style={{ marginTop:5, display:'flex', flexWrap:'wrap', gap:3 }}>
                {(liveSkills.required||[]).slice(0,8).map(s=><span key={s} style={{ padding:'2px 8px', borderRadius:20, background:'#FEE2E2', color:'#991B1B', fontSize:10, fontWeight:700 }}>{s}</span>)}
                {(liveSkills.preferred||[]).slice(0,4).map(s=><span key={s} style={{ padding:'2px 8px', borderRadius:20, background:'#DBEAFE', color:'#1D4ED8', fontSize:10, fontWeight:600 }}>{s}</span>)}
              </div>
            )}
          </div>
          {error&&<div style={{ padding:'9px 12px', background:'#FEE2E2', borderRadius:8, fontSize:12, color:'#991B1B', marginBottom:10 }}>{error}</div>}
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={handleAnalyzeAndProceed} disabled={parsing||!pasteText.trim()}
              style={{ padding:'10px 22px', borderRadius:10, border:'none', background:(parsing||!pasteText.trim())?'#E5E7EB':'linear-gradient(135deg,#00C982,#009963)', color:(parsing||!pasteText.trim())?'#9CA3AF':'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              {parsing?'Parsing JD...':'Parse and Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
