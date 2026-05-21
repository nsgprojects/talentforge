import { useState, useRef } from 'react';
import { resumeApi } from '../../lib/api';
import ResumeDashboard from './ResumeDashboard';

const G='#00C982',GD='#009963';
const Btn = ({ onClick, disabled, children, style={} }) => (
  <button onClick={onClick} disabled={disabled} style={{ padding:'9px 18px', borderRadius:9, border:'none', background:disabled?'#E5E7EB':'linear-gradient(135deg,#00C982,#009963)', color:disabled?'#9CA3AF':'white', fontSize:13, fontWeight:700, cursor:disabled?'not-allowed':'pointer', ...style }}>{children}</button>
);

export default function UploadStep({ onComplete, existingResumes=[] }) {
  const [text,     setText]    = useState('');
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState('');
  const [fileInfo, setFileInfo]= useState(null);
  const [dragging, setDragging]= useState(false);
  const [parsed,   setParsed]  = useState(null);
  const [docxB64,  setDocxB64] = useState(null);
  const [extracted,setExtracted]=useState([]);
  const [fmt,      setFmt]     = useState('E');
  const [origName, setOrigName]= useState('');
  const [mode,     setMode]    = useState('upload'); // 'upload' | 'existing'
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['docx','txt','pdf'].includes(ext)) { setError('Only .docx, .pdf, .txt supported'); return; }
    setFileInfo({ name:file.name, size:(file.size/1024).toFixed(0)+' KB' });
    setError(''); setParsed(null); setDocxB64(null); setLoading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await resumeApi.parse(fd);
      setText(res.rawText||'');
      setParsed(res.data);
      setDocxB64(res.docxBase64||null);
      setExtracted(res.extractedExperiences||[]);
      setFmt(res.detectedFormat||'E');
      setOrigName(file.name);
    } catch(e) { setError(e.message); setFileInfo(null); }
    finally { setLoading(false); }
  };

  const handleParseText = async () => {
    const t = text.trim();
    if (!t||t.length<80) { setError('Add resume text (80+ chars)'); return; }
    setError(''); setParsed(null); setLoading(true);
    try {
      const res = await resumeApi.parse({ text: t });
      setParsed(res.data); setExtracted(res.extractedExperiences||[]); setFmt(res.detectedFormat||'E');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const card = { background:'white', borderRadius:14, padding:'20px 22px', border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.05)', marginBottom:16 };
  const sTitle = { fontSize:18, fontWeight:800, color:'#0D1B2A', margin:'0 0 4px', letterSpacing:'-.3px' };
  const sSub   = { fontSize:13, color:'#6B7280', margin:'0 0 18px', lineHeight:1.6 };

  return (
    <div style={card}>
      <div style={sTitle}>Upload your resume</div>
      <div style={sSub}>Supports DOCX, PDF, TXT - and 12 resume format types (consulting, table-header, plain text, and more)</div>

      {/* Mode tabs */}
      {existingResumes.length>0 && (
        <div style={{display:'flex',gap:0,background:'#F3F4F6',borderRadius:9,padding:3,width:'fit-content',marginBottom:16}}>
          {[['upload','Upload New'],['existing','Use Existing']].map(([id,lbl])=>(
            <button key={id} onClick={()=>setMode(id)} style={{padding:'6px 16px',borderRadius:7,border:'none',fontSize:12,fontWeight:600,cursor:'pointer',background:mode===id?'white':'transparent',color:mode===id?'#0D1B2A':'#6B7280',boxShadow:mode===id?'0 1px 3px rgba(0,0,0,.08)':'none',transition:'all .15s'}}>{lbl}</button>
          ))}
        </div>
      )}

      {/* Existing resumes selector */}
      {mode==='existing' && (
        <div>
          {existingResumes.map(r=>(
            <div key={r.id} style={{padding:'11px 13px',borderRadius:10,border:'1px solid #E5E7EB',background:'white',marginBottom:8,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}
              onClick={()=>onComplete(r.content, r.content?.rawText||'', r.original_file_b64, r.content?.experiences||[], r.detected_format||'E', r.id, r.original_file_name)}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'#0D1B2A'}}>{r.name}</div>
                <div style={{fontSize:11,color:'#9CA3AF'}}>V{r.version_number} . {r.tech_stack||'General'} . Updated {new Date(r.updated_at).toLocaleDateString()}</div>
              </div>
              <span style={{fontSize:12,color:G,fontWeight:700}}>Use  </span>
            </div>
          ))}
        </div>
      )}

      {/* Upload mode */}
      {mode==='upload' && !parsed && (
        <>
          <label className="upload-zone"
            style={{ display:'block', border:`2px dashed ${dragging?G:'#D1D5DB'}`, borderRadius:12, padding:'28px 20px', textAlign:'center', cursor:'pointer', background:dragging?'#E6FAF2':'#FAFAFA', transition:'all .15s', marginBottom:16 }}
            onDragOver={e=>{e.preventDefault();setDragging(true)}}
            onDragLeave={()=>setDragging(false)}
            onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0])}}>
            <input ref={fileRef} type="file" style={{display:'none'}} accept=".docx,.txt,.pdf" onChange={e=>handleFile(e.target.files[0])}/>
            {loading&&fileInfo ? (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                <div style={{width:28,height:28,border:`3px solid ${G}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
                <div style={{fontSize:13,color:'#374151'}}>Parsing {fileInfo.name}...</div>
              </div>
            ) : (
              <div>
                <div style={{fontSize:36,marginBottom:8}}></div>
                <div style={{fontSize:13,fontWeight:600,color:'#374151',marginBottom:4}}>
                  {fileInfo ? `${fileInfo.name} . ${fileInfo.size}` : 'Drop file here or click to browse'}
                </div>
                <div style={{fontSize:11,color:'#9CA3AF'}}>.docx (recommended) . .pdf . .txt</div>
              </div>
            )}
          </label>

          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
            <div style={{flex:1,height:1,background:'#E5E7EB'}}/>
            <span style={{fontSize:11,color:'#9CA3AF'}}>or paste text</span>
            <div style={{flex:1,height:1,background:'#E5E7EB'}}/>
          </div>

          {!fileInfo&&<textarea value={text} onChange={e=>setText(e.target.value)} rows={7} placeholder="Paste your full resume text here..." style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'2px solid #E5E7EB',fontSize:12,resize:'vertical',outline:'none',color:'#374151',lineHeight:1.5,marginBottom:12,boxSizing:'border-box'}}/>}

          {error&&<div style={{padding:'10px 13px',background:'#FEE2E2',border:'1px solid #FCA5A5',borderRadius:9,fontSize:12,color:'#991B1B',marginBottom:12}}>{error}</div>}

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:11,color:'#9CA3AF'}}>Supports 12 format types including Client/Duration, table-header, Company|Title|Date</span>
            {!fileInfo&&<Btn onClick={handleParseText} disabled={loading||!text.trim()}>{loading?'Parsing...':'Parse resume ->'}</Btn>}
          </div>
        </>
      )}

      {parsed && (
        <>
          <ResumeDashboard parsed={parsed}/>
          <div style={{marginTop:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <button onClick={()=>{setParsed(null);setFileInfo(null);setText('');setDocxB64(null);setExtracted([]);setFmt('E');setOrigName('');}} style={{padding:'8px 14px',borderRadius:8,border:'1px solid #E5E7EB',background:'white',fontSize:12,cursor:'pointer',color:'#374151',fontWeight:600}}>Re-upload</button>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {docxB64&&<span style={{padding:'3px 9px',borderRadius:20,background:'#D1FAE5',color:'#059669',fontSize:11,fontWeight:700}}>DOCX - format preserved</span>}
              <Btn onClick={()=>onComplete(parsed, text, docxB64, extracted, fmt, null, origName)}>Continue to JD  </Btn>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
