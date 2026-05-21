import { useState, useEffect, useRef } from 'react';
import { renderAsync } from 'docx-preview';
import { resumeApi } from '../../lib/api';

const G = '#00C982';

function base64ToBlob(base64) {
  var clean  = base64.replace(/^data:[^;]+;base64,/, '');
  var binary = atob(clean);
  var bytes  = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export default function ResumeViewer({ resume, onBack, onEdit, onDelete }) {
  var [status, setStatus] = useState('loading'); // loading | rendering | done | error | text
  var [error,  setError]  = useState('');
  var [rawText,setRawText]= useState('');
  var containerRef        = useRef(null);
  var ext = (resume.original_file_name || '').split('.').pop().toLowerCase();

  useEffect(function() {
    setStatus('loading');
    setError('');

    resumeApi.getBaseById(resume.id)
      .then(function(full) {
        var b64 = full.original_file_b64;

        if (!b64) {
          // No binary stored - show text fallback
          var txt = (full.content && full.content.rawText) || full.summary_text || '';
          setRawText(txt);
          setStatus('text');
          return;
        }

        if (ext === 'txt') {
          var txt2 = (full.content && full.content.rawText) || full.summary_text || atob(b64.replace(/^data:[^;]+;base64,/, ''));
          setRawText(txt2);
          setStatus('text');
          return;
        }

        if (ext === 'docx' || ext === 'doc') {
          setStatus('rendering');
          // Give React a tick to render the container div
          setTimeout(function() {
            if (!containerRef.current) {
              setError('Render container not found. Please try again.');
              setStatus('error');
              return;
            }
            var blob = base64ToBlob(b64);
            renderAsync(blob, containerRef.current, null, {
              className:    'docx-render',
              inWrapper:    true,
              ignoreWidth:  false,
              ignoreHeight: false,
              breakPages:   true,
              ignoreFonts:  false,
              trimXmlDeclaration: true,
              experimental: false,
            })
              .then(function() { setStatus('done'); })
              .catch(function(e) {
                console.error('docx-preview error:', e);
                // Fall back to raw text
                var txt3 = (full.content && full.content.rawText) || full.summary_text || '';
                setRawText(txt3);
                setStatus('text');
              });
          }, 80);
          return;
        }

        // PDF or unknown - show text fallback
        var txtFallback = (full.content && full.content.rawText) || full.summary_text || '';
        setRawText(txtFallback);
        setStatus('text');
      })
      .catch(function(e) {
        setError('Could not load resume: ' + e.message);
        setStatus('error');
      });
  }, [resume.id]);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 57px)', fontFamily:'system-ui,sans-serif', background:'#EBEBEB' }}>

      {/* Header */}
      <div style={{ background:'white', borderBottom:'1px solid #F0F0F0', padding:'12px 24px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <button onClick={onBack} style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', fontSize:12, fontWeight:600, cursor:'pointer', color:'#374151', fontFamily:'inherit' }}>Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:800, color:'#0D1B2A' }}>{resume.name}</div>
          <div style={{ fontSize:11, color:'#9CA3AF' }}>
            {ext ? ext.toUpperCase() + ' . ' : ''}V{resume.version_number} . {resume.tech_stack || 'General'}
          </div>
        </div>
        <span style={{ padding:'4px 12px', borderRadius:20, background:'#D1FAE5', color:'#059669', fontSize:12, fontWeight:800 }}> Uploaded Resume</span>
        <button onClick={onEdit}
          style={{ padding:'8px 16px', borderRadius:9, border:'1px solid #E5E7EB', background:'white', fontSize:13, fontWeight:700, cursor:'pointer', color:'#374151', fontFamily:'inherit' }}>
           Edit
        </button>
        <button onClick={function() { if (onDelete) onDelete(resume.id); }}
          style={{ padding:'8px 14px', borderRadius:9, border:'1.5px solid #EF4444', background:'white', fontSize:13, fontWeight:700, cursor:'pointer', color:'#EF4444', fontFamily:'inherit' }}>
          Delete
        </button>
      </div>

      {/* Body */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', justifyContent:'center', padding:'28px 16px' }}>

        {(status === 'loading' || status === 'rendering') && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, paddingTop:80 }}>
            <div style={{ width:38, height:38, border:'3px solid ' + G, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
            <div style={{ fontSize:14, color:'#6B7280' }}>{status === 'loading' ? 'Loading document...' : 'Rendering DOCX...'}</div>
            <div style={{ fontSize:12, color:'#9CA3AF' }}>Preserving original formatting</div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding:'20px 24px', background:'#FEE2E2', border:'1px solid #FCA5A5', borderRadius:12, fontSize:13, color:'#991B1B' }}>
            ! {error}
          </div>
        )}

        {/* DOCX rendered here - docx-preview fills this div */}
        <div
          ref={containerRef}
          style={{ width:'100%', maxWidth:960, display: (status === 'rendering' || status === 'done') ? 'block' : 'none' }}>
        </div>

        {/* Text fallback */}
        {status === 'text' && rawText && (
          <div style={{ width:'100%', maxWidth:820, background:'white', borderRadius:10, padding:'36px 44px', boxShadow:'0 4px 20px rgba(0,0,0,.1)', fontFamily:'Times New Roman, serif' }}>
            <pre style={{ fontSize:12, lineHeight:1.8, color:'#374151', whiteSpace:'pre-wrap', margin:0, fontFamily:'Times New Roman, serif' }}>{rawText}</pre>
          </div>
        )}

        {status === 'text' && !rawText && (
          <div style={{ padding:'40px', textAlign:'center', color:'#9CA3AF', fontSize:14 }}>
            No preview available. The original file content was not stored. Please re-upload the file.
          </div>
        )}
      </div>

      {/* docx-preview default styles */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .docx-render .docx-wrapper { background: #EBEBEB !important; padding: 20px !important; }
        .docx-render .docx-wrapper section.docx {
          box-shadow: 0 4px 24px rgba(0,0,0,.18) !important;
          margin: 0 auto 20px !important;
        }
      `}</style>
    </div>
  );
}
