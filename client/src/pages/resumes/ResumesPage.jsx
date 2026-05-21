import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { resumeApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import ResumeEditor from './ResumeEditor';
import ResumeViewer from './ResumeViewer';

const G  = '#00C982';
const GD = '#009963';

export default function ResumesPage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const fileRef   = useRef(null);

  var [resumes,   setResumes]   = useState([]);
  var [loading,   setLoading]   = useState(true);
  var [selected,  setSelected]  = useState(null);
  var [mode,      setMode]      = useState('list'); // 'list' | 'viewer' | 'editor'
  var [uploading, setUploading] = useState(false);
  var [uploadMsg, setUploadMsg] = useState('');

  function load() {
    resumeApi.getBase()
      .then(function(r) { setResumes(r || []); })
      .catch(console.error)
      .finally(function() { setLoading(false); });
  }
  useEffect(function() { load(); }, []);

  function handleDelete(id) {
    if (!confirm('Delete this resume?')) return;
    resumeApi.deleteBase(id)
      .then(function() {
        setResumes(function(prev) { return prev.filter(function(r) { return r.id !== id; }); });
        setSelected(null); setMode('list');
      })
      .catch(function(e) { alert(e.message); });
  }

  function handleSaved(resume) {
    setResumes(function(prev) {
      var idx = prev.findIndex(function(r) { return r.id === resume.id; });
      return idx >= 0 ? prev.map(function(r) { return r.id === resume.id ? resume : r; }) : [resume, ...prev];
    });
    setMode('list');
  }

  function handleCardClick(r) {
    setSelected(r);
    var isUploaded = !!(r.original_file_name || r.source === 'upload');
    setMode(isUploaded ? 'viewer' : 'editor');
  }

  function handleUploadFile(file) {
    if (!file) return;
    var ext = file.name.split('.').pop().toLowerCase();
    if (!['docx','pdf','txt'].includes(ext)) { alert('Only .docx, .pdf, .txt supported'); return; }
    setUploading(true);
    setUploadMsg('Parsing ' + file.name + '...');
    var fd = new FormData(); fd.append('file', file);
    resumeApi.parse(fd)
      .then(function(res) {
        var parsed = res.data || {};
        setUploadMsg('Saving to pool...');
        return resumeApi.saveBase({
          name:             file.name.replace(/\.[^.]+$/, '') || parsed.name || 'Uploaded Resume',
          tech_stack:       null,
          years_experience: parsed.years || null,
          parsed:           parsed,
          rawText:          res.rawText || '',
          docxBase64:       res.docxBase64 || null,
          originalName:     file.name,
          detectedFormat:   res.detectedFormat || 'E',
          source:           'upload',
        });
      })
      .then(function(saved) {
        setResumes(function(prev) { return [saved, ...prev]; });
        setUploadMsg('');
      })
      .catch(function(e) { setUploadMsg(''); alert('Upload failed: ' + e.message); })
      .finally(function() { setUploading(false); });
  }

  // VIEWER mode - uploaded resume formatted display
  if (mode === 'viewer' && selected) {
    return (
      <ResumeViewer
        resume={selected}
        onBack={function() { setMode('list'); load(); }}
        onEdit={function() { setMode('editor'); }}
        onDelete={handleDelete}
      />
    );
  }

  // EDITOR mode - create from scratch or edit
  if (mode === 'editor') {
    return (
      <div style={{ display:'flex', width:'100%', height:'calc(100vh - 57px)', fontFamily:'system-ui,sans-serif' }}>
        <ResumeEditor
          resume={selected}
          onBack={function() { setMode('list'); load(); }}
          onSave={handleSaved}
          onDelete={handleDelete}
        />
      </div>
    );
  }

  // LIST mode
  return (
    <div style={{ fontFamily:'system-ui,sans-serif', height:'calc(100vh - 57px)', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:'white', borderBottom:'1px solid #F0F0F0', padding:'14px 28px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, color:'#0D1B2A', margin:0 }}>
            {user && user.role === 'admin' ? 'All Base Resumes' : 'My Base Resumes'}
          </h1>
          <p style={{ fontSize:12, color:'#9CA3AF', margin:'2px 0 0' }}>Base resumes are the foundation - optimizer tailors these per job</p>
        </div>
        <div style={{ display:'flex', gap:9, alignItems:'center' }}>
          {uploadMsg && <span style={{ fontSize:12, color:G, fontWeight:600 }}>{uploadMsg}</span>}
          <button onClick={function() { navigate('/dashboard/optimizer'); }}
            style={{ padding:'9px 16px', borderRadius:9, border:'1px solid #E5E7EB', background:'white', fontSize:13, fontWeight:700, cursor:'pointer', color:'#374151', fontFamily:'inherit' }}>
            + Run Optimizer
          </button>
          <input ref={fileRef} type="file" accept=".docx,.pdf,.txt" style={{ display:'none' }}
            onChange={function(e) { if (e.target.files[0]) handleUploadFile(e.target.files[0]); e.target.value = ''; }}/>
          <button onClick={function() { fileRef.current && fileRef.current.click(); }} disabled={uploading}
            style={{ padding:'9px 18px', borderRadius:9, border:'none', background:uploading?'#E5E7EB':'linear-gradient(135deg,#00C982,#009963)', color:uploading?'#9CA3AF':'white', fontSize:13, fontWeight:700, cursor:uploading?'not-allowed':'pointer', boxShadow:uploading?'none':'0 4px 12px rgba(0,201,130,.3)', fontFamily:'inherit' }}>
            {uploading ? '... Uploading...' : ' Upload Resume'}
          </button>
          <button onClick={function() { setSelected(null); setMode('editor'); }}
            style={{ padding:'9px 18px', borderRadius:9, border:'1.5px solid '+G, background:'white', color:GD, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            + Create Resume
          </button>
        </div>
      </div>

      {/* Pool */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 28px', background:'#F5F7F5' }}>
        {loading && <div style={{ padding:'60px', textAlign:'center', color:'#9CA3AF' }}>Loading...</div>}

        {!loading && resumes.length === 0 && (
          <div style={{ background:'white', borderRadius:14, padding:'60px', textAlign:'center', border:'1px solid #F0F0F0' }}>
            <div style={{ fontSize:44, marginBottom:14 }}></div>
            <div style={{ fontSize:18, fontWeight:700, color:'#0D1B2A', marginBottom:8 }}>No base resumes yet</div>
            <div style={{ fontSize:13, color:'#9CA3AF', marginBottom:22 }}>Upload a DOCX, PDF, or TXT - or create one from scratch</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={function() { fileRef.current && fileRef.current.click(); }}
                style={{ padding:'11px 22px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00C982,#009963)', color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                 Upload Resume
              </button>
              <button onClick={function() { setSelected(null); setMode('editor'); }}
                style={{ padding:'11px 22px', borderRadius:10, border:'1.5px solid '+G, background:'white', color:GD, fontSize:14, fontWeight:700, cursor:'pointer' }}>
                + Create from Scratch
              </button>
            </div>
          </div>
        )}

        {!loading && resumes.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
            {resumes.map(function(r) {
              var s          = r.ats_score || 0;
              var isUploaded = !!(r.original_file_name || r.source === 'upload');
              return (
                <div key={r.id}
                  style={{ background:'white', borderRadius:14, border:'1px solid #F0F0F0', padding:'16px 18px', cursor:'pointer', transition:'all .15s', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}
                  onMouseEnter={function(e) { e.currentTarget.style.borderColor=G; e.currentTarget.style.boxShadow='0 0 0 3px '+G+'22'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.borderColor='#F0F0F0'; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.05)'; }}
                  onClick={function() { handleCardClick(r); }}>

                  <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:10 }}>
                    <div style={{ width:42, height:42, borderRadius:11, background:'linear-gradient(135deg,#00C982,#009963)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:16, fontWeight:800, flexShrink:0 }}>
                      {(r.name || 'R').charAt(0)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'#0D1B2A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:3 }}>{r.name}</div>
                      <div style={{ fontSize:11, color:'#9CA3AF' }}>
                        {user && user.role === 'admin' && r.user_name ? r.user_name + ' . ' : ''}
                        V{r.version_number} . {r.tech_stack || 'General'} . {new Date(r.updated_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                      </div>
                    </div>
                    {s > 0 && (
                      <span style={{ padding:'3px 8px', borderRadius:6, background:s>=70?'#D1FAE5':s>=50?'#FEF3C7':'#FEE2E2', color:s>=70?'#059669':s>=50?'#92400E':'#991B1B', fontSize:11, fontWeight:700, flexShrink:0 }}>
                        {s>=70?'STRONG':s>=50?'IMPROVABLE':'WEAK'}
                      </span>
                    )}
                  </div>

                  {/* Bold colored badge */}
                  <div style={{ marginBottom:10 }}>
                    {isUploaded ? (
                      <span style={{ padding:'4px 12px', borderRadius:20, background:'#D1FAE5', color:'#059669', fontSize:12, fontWeight:800 }}> Uploaded Resume</span>
                    ) : (
                      <span style={{ padding:'4px 12px', borderRadius:20, background:'#EDE9FE', color:'#7C3AED', fontSize:12, fontWeight:800 }}> Created Resume</span>
                    )}
                  </div>

                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={function(e) { e.stopPropagation(); navigate('/dashboard/optimizer'); }}
                      style={{ flex:1, padding:'6px', borderRadius:8, border:'1px solid '+G, background:'white', fontSize:11, fontWeight:700, cursor:'pointer', color:GD }}>
                      Optimize +
                    </button>
                    <button onClick={function(e) { e.stopPropagation(); handleDelete(r.id); }}
                      style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #F0F0F0', background:'white', fontSize:11, cursor:'pointer', color:'#9CA3AF' }}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
