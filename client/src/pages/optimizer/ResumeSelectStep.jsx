import { useState, useRef } from 'react';
import { resumeApi } from '../../lib/api';
import ResumeDashboard from './ResumeDashboard';

const G='#00C982', GD='#009963';

export default function ResumeSelectStep({ resumePool, loadingPools, prefillResume, onComplete, onBack }) {
  const [mode,      setMode]     = useState(prefillResume ? 'prefill' : 'pool');
  const [parsed,    setParsed]   = useState(null);
  const [rawText,   setRawText]  = useState('');
  const [docxB64,   setDocxB64]  = useState(null);
  const [exps,      setExps]     = useState([]);
  const [fmt,       setFmt]      = useState('E');
  const [origName,  setOrigName] = useState('');
  const [loading,   setLoading]  = useState(false);
  const [error,     setError]    = useState('');
  const [dragging,  setDragging] = useState(false);
  const [selectedId,setSelectedId]=useState(prefillResume?.id||null);
  const [pasteText, setPasteText]= useState('');
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    const ext=file.name.split('.').pop().toLowerCase();
    if (!['docx','pdf','txt'].includes(ext)) { setError('Only .docx, .pdf, .txt supported'); return; }
    setLoading(true); setError(''); setParsed(null);
    try {
      const fd=new FormData(); fd.append('file',file);
      const res=await resumeApi.parse(fd);
      setParsed(res.data); setRawText(res.rawText||''); setDocxB64(res.docxBase64||null);
      setExps(res.extractedExperiences||[]); setFmt(res.detectedFormat||'E'); setOrigName(file.name);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleParseText = async () => {
    if (!pasteText.trim()||pasteText.length<80) { setError('Add resume text (80+ chars)'); return; }
    setLoading(true); setError(''); setParsed(null);
    try {
      const res=await resumeApi.parseText(pasteText);
      setParsed(res.data); setRawText(pasteText); setExps(res.extractedExperiences||[]); setFmt(res.detectedFormat||'E');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handlePoolSelect = (r) => {
    setSelectedId(r.id);
    // content is stored in { header, summary, skills, experiences, education, certifications, rawText } shape
    var content = r.content || {};
    onComplete({
      id:               r.id,
      parsed:           content,
      rawText:          content.rawText || r.summary_text || '',
      docxBase64:       r.original_file_b64 || null,
      extractedExps:    content.experiences || [],
      detectedFormat:   r.detected_format || 'E',
      originalFileName: r.original_file_name || '',
    });
  };

  const handleUploadComplete = () => {
    onComplete({
      id: null,
      parsed,
      rawText,
      docxBase64: docxB64,
      extractedExps: exps,
      detectedFormat: fmt,
      originalFileName: origName,
    });
  };

  const card = { background:'white', borderRadius:14, padding:'20px 22px', border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.05)' };

  return (
    <div style={card}>
      <div style={{ fontSize:18, fontWeight:800, color:'#0D1B2A', marginBottom:4 }}>Step 2 - Select Resume</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>Choose from your base resumes or upload a new one</div>

      {/* Prefill banner */}
      {prefillResume && (
        <div style={{ padding:'10px 13px', background:'#E6FAF2', border:'1px solid #A7F3D0', borderRadius:9, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#059669' }}>Pre-selected resume - use or change below</div>
          <div style={{ display:'flex', gap:7 }}>
            <button onClick={()=>onComplete({
                id:               prefillResume.id,
                parsed:           prefillResume.parsed,
                rawText:          prefillResume.rawText||'',
                docxBase64:       prefillResume.docxBase64||null,
                extractedExps:    prefillResume.extractedExps||[],
                detectedFormat:   prefillResume.detectedFormat||'E',
                originalFileName: prefillResume.originalFileName||'',
              })}
              style={{ padding:'7px 14px', borderRadius:8, border:'none', background:G, color:'white', fontSize:12, fontWeight:700, cursor:'pointer' }}>Use this</button>
            <button onClick={()=>setMode('pool')} style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', fontSize:12, cursor:'pointer', color:'#374151' }}>Change</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, background:'#F3F4F6', borderRadius:9, padding:3, marginBottom:14, width:'fit-content' }}>
        {[['pool','My Resumes'],['upload','Upload New'],['paste','Paste Text']].map(([id,lbl])=>(
          <button key={id} onClick={()=>{ setMode(id); setParsed(null); setError(''); }} style={{ padding:'6px 14px', borderRadius:7, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', background:mode===id?'white':'transparent', color:mode===id?'#0D1B2A':'#6B7280', fontFamily:'inherit', transition:'all .15s' }}>{lbl}</button>
        ))}
      </div>

      {/* Pool mode */}
      {(mode==='pool'||mode==='prefill') && (
        <div>
          {loadingPools && <div style={{ padding:'30px', textAlign:'center', color:'#9CA3AF' }}>Loading resumes...</div>}
          {!loadingPools && resumePool.length===0 && (
            <div style={{ padding:'20px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>No base resumes yet. Switch to "Upload New".</div>
          )}
          <div style={{ maxHeight:360, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
            {resumePool.map(r=>{
              var isUploaded = !!(r.original_file_name);
              var updatedAt  = new Date(r.updated_at).getTime();
              var createdAt  = new Date(r.created_at).getTime();
              var daysDiff   = (Date.now() - updatedAt) / (1000*60*60*24);
              var wasEdited  = (updatedAt - createdAt) > 60*1000 && daysDiff < 30;
              var tmplLabel  = (r.template_name || 'classic') === 'executive' ? 'Executive' : 'Classic';
              return (
              <div key={r.id} onClick={()=>handlePoolSelect(r)}
                style={{ padding:'12px', borderRadius:10, border:`1.5px solid ${selectedId===r.id?G:'#E5E7EB'}`, background:selectedId===r.id?'#F0FDF7':'white', cursor:'pointer', display:'flex', gap:10, alignItems:'center', transition:'all .15s' }}>
                <div style={{ width:38, height:38, borderRadius:10, background:`linear-gradient(135deg,${G},${GD})`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:16, fontWeight:800, flexShrink:0 }}>
                  {(r.name||'R').charAt(0)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#0D1B2A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>{r.name}</div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                    {isUploaded
                      ? <span style={{ padding:'2px 7px', borderRadius:20, fontSize:10, fontWeight:700, background:'#DBEAFE', color:'#1D4ED8' }}>Uploaded</span>
                      : <span style={{ padding:'2px 7px', borderRadius:20, fontSize:10, fontWeight:700, background:'#D1FAE5', color:'#059669' }}>Created</span>
                    }
                    {wasEdited && <span style={{ padding:'2px 7px', borderRadius:20, fontSize:10, fontWeight:700, background:'#FEF3C7', color:'#92400E' }}>Updated</span>}
                    <span style={{ padding:'2px 7px', borderRadius:20, fontSize:10, fontWeight:600, background:'#F3F4F6', color:'#6B7280' }}>{tmplLabel}</span>
                    <span style={{ fontSize:10, color:'#9CA3AF' }}>V{r.version_number} &middot; {r.tech_stack||'General'}</span>
                  </div>
                </div>
                {r.ats_score>0&&<div style={{ textAlign:'center', flexShrink:0 }}><div style={{ fontSize:16, fontWeight:700, color:G }}>{r.ats_score}</div><div style={{ fontSize:9, color:'#9CA3AF' }}>ATS</div></div>}
                <span style={{ fontSize:12, color:G, fontWeight:700, flexShrink:0 }}>Use</span>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload mode */}
      {mode==='upload' && (
        <div>
          {!parsed ? (
            <>
              <label style={{ display:'block', border:`2px dashed ${dragging?G:'#D1D5DB'}`, borderRadius:12, padding:'32px 20px', textAlign:'center', cursor:'pointer', background:dragging?'#E6FAF2':'#FAFAFA', transition:'all .15s', marginBottom:12 }}
                onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)}
                onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0])}}>
                <input ref={fileRef} type="file" style={{ display:'none' }} accept=".docx,.txt,.pdf" onChange={e=>handleFile(e.target.files[0])}/>
                {loading ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                    <div style={{ width:28, height:28, border:`3px solid ${G}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
                    <div style={{ fontSize:13, color:'#374151' }}>Parsing resume...</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize:36, marginBottom:8 }}></div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginBottom:4 }}>Drop file here or click to browse</div>
                    <div style={{ fontSize:11, color:'#9CA3AF' }}>.docx (recommended) . .pdf . .txt . 12 format types</div>
                  </div>
                )}
              </label>
              {error&&<div style={{ padding:'9px 12px', background:'#FEE2E2', borderRadius:8, fontSize:12, color:'#991B1B', marginBottom:10 }}>{error}</div>}
            </>
          ) : (
            <>
              <ResumeDashboard parsed={parsed}/>
              <div style={{ marginTop:14, display:'flex', justifyContent:'space-between' }}>
                <button onClick={()=>{setParsed(null);setError('');}} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', fontSize:12, cursor:'pointer', color:'#374151', fontWeight:600 }}>Re-upload</button>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {docxB64&&<span style={{ padding:'3px 9px', borderRadius:20, background:'#D1FAE5', color:'#059669', fontSize:11, fontWeight:700 }}>DOCX preserved</span>}
                  <button onClick={handleUploadComplete} style={{ padding:'10px 22px', borderRadius:10, border:'none', background:`linear-gradient(135deg,${G},${GD})`, color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    Use this resume
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Paste mode */}
      {mode==='paste' && (
        <div>
          {!parsed ? (
            <>
              <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)} rows={10}
                placeholder="Paste your full resume text here..."
                style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #E5E7EB', fontSize:12, resize:'vertical', outline:'none', color:'#374151', lineHeight:1.5, boxSizing:'border-box', fontFamily:'inherit', marginBottom:10 }}/>
              {error&&<div style={{ padding:'9px 12px', background:'#FEE2E2', borderRadius:8, fontSize:12, color:'#991B1B', marginBottom:10 }}>{error}</div>}
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button onClick={handleParseText} disabled={loading||!pasteText.trim()}
                  style={{ padding:'10px 22px', borderRadius:10, border:'none', background:(loading||!pasteText.trim())?'#E5E7EB':`linear-gradient(135deg,${G},${GD})`, color:(loading||!pasteText.trim())?'#9CA3AF':'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  {loading?'Parsing...':'Parse resume ->'}
                </button>
              </div>
            </>
          ) : (
            <>
              <ResumeDashboard parsed={parsed}/>
              <div style={{ marginTop:14, display:'flex', justifyContent:'space-between' }}>
                <button onClick={()=>{setParsed(null);setPasteText('');}} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', fontSize:12, cursor:'pointer', color:'#374151', fontWeight:600 }}>Re-paste</button>
                <button onClick={handleUploadComplete} style={{ padding:'10px 22px', borderRadius:10, border:'none', background:`linear-gradient(135deg,${G},${GD})`, color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>Use this resume  </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Back button */}
      <div style={{ marginTop:16, paddingTop:12, borderTop:'1px solid #F0F0F0' }}>
        <button onClick={onBack} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', fontSize:12, fontWeight:600, cursor:'pointer', color:'#374151' }}>Back to JD</button>
      </div>
    </div>
  );
}
