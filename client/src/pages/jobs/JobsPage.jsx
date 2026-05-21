import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { jdApi, resumeApi } from '../../lib/api';
import JDDetailPanel from './JDDetailPanel';
import AIToolsSidebar from './AIToolsSidebar';
import useDragResize from '../../lib/useDragResize';

const G  = '#00C982';
const GD = '#009963';

const STATUS_COLORS = {
  saved:    { bg:'#E6FAF2', color:GD },
  liked:    { bg:'#DBEAFE', color:'#1D4ED8' },
  applied:  { bg:'#EDE9FE', color:'#7C3AED' },
  archived: { bg:'#F3F4F6', color:'#6B7280' },
};

// Modal for adding a new JD
function AddJDModal({ onClose, onSaved }) {
  var [pasteText,  setPasteText]  = useState('');
  var [liveSkills, setLiveSkills] = useState({ required:[], preferred:[], title:'' });
  var [parsing,    setParsing]    = useState(false);
  var [saving,     setSaving]     = useState(false);
  var [uploading,  setUploading]  = useState(false);
  var [dupMsg,     setDupMsg]     = useState('');
  var fileRef  = useRef(null);
  var debounce = useRef(null);

  function handleText(text) {
    setPasteText(text); setDupMsg('');
    if (debounce.current) clearTimeout(debounce.current);
    setLiveSkills({ required:[], preferred:[], title:'' });
    if (text.length < 60) return;
    debounce.current = setTimeout(function() {
      jdApi.liveParse(text).then(function(r) { setLiveSkills(r.data || {}); }).catch(function() {});
    }, 900);
  }

  function handleFile(file) {
    if (!file) return;
    setUploading(true);
    var fd = new FormData(); fd.append('file', file);
    jdApi.parseFile(fd)
      .then(function(r) { setPasteText(r.rawText || ''); setLiveSkills(r.data || {}); })
      .catch(function(e) { alert('Could not read file: ' + e.message); })
      .finally(function() { setUploading(false); });
  }

  function save(analyze) {
    if (!pasteText.trim() || pasteText.length < 30) return;
    setDupMsg('');
    analyze ? setParsing(true) : setSaving(true);
    var promise = analyze
      ? jdApi.parse(pasteText).then(function(r) { return jdApi.save({ raw_text: pasteText, parsed: r.data || r }); })
      : jdApi.save({ raw_text: pasteText });
    promise
      .then(function(saved) { onSaved(saved); })
      .catch(function(e) {
        if (e.message === 'duplicate' || (e.message||'').toLowerCase().includes('already exists')) {
          setDupMsg('This JD is already in your list.');
        } else { alert(e.message); }
      })
      .finally(function() { setParsing(false); setSaving(false); });
  }

  var liveR = (liveSkills.required  || []).slice(0, 8);
  var liveP = (liveSkills.preferred || []).slice(0, 4);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:'white', borderRadius:16, width:680, maxWidth:'95vw', maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
        {/* Modal header */}
        <div style={{ background:'linear-gradient(135deg,#0D1B2A,#1E3A2F)', padding:'18px 24px', borderRadius:'16px 16px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'white' }}>Add Job Description</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.6)', marginTop:2 }}>Paste or upload a JD - skills detected live</div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:'50%', border:'none', background:'rgba(255,255,255,.1)', color:'white', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>x</button>
        </div>

        {/* Modal body */}
        <div style={{ padding:'20px 24px' }}>
          {/* Live title detection */}
          {liveSkills.title && (
            <div style={{ padding:'8px 12px', background:'#E6FAF2', border:'1px solid #A7F3D0', borderRadius:8, fontSize:12, color:GD, fontWeight:600, marginBottom:10 }}>
              + Detected: {liveSkills.title}
            </div>
          )}

          <textarea
            value={pasteText}
            onChange={function(e) { handleText(e.target.value); }}
            rows={10}
            placeholder="Paste the full job description here - required and preferred skills will appear below as you type..."
            autoFocus
            style={{ width:'100%', padding:'12px', borderRadius:10, border:'1.5px solid ' + (pasteText.length > 50 ? G : '#E5E7EB'), fontSize:13, resize:'vertical', outline:'none', color:'#374151', lineHeight:1.6, boxSizing:'border-box', fontFamily:'inherit', transition:'border-color .2s' }}
          />

          {/* Live skill badges */}
          {(liveR.length > 0 || liveP.length > 0) && (
            <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:4 }}>
              {liveR.map(function(s) { return <span key={s} style={{ padding:'2px 9px', borderRadius:20, background:'#FEE2E2', color:'#991B1B', fontSize:11, fontWeight:700 }}>{s}</span>; })}
              {liveP.map(function(s) { return <span key={s} style={{ padding:'2px 9px', borderRadius:20, background:'#DBEAFE', color:'#1D4ED8', fontSize:11, fontWeight:600 }}>{s}</span>; })}
            </div>
          )}

          {dupMsg && (
            <div style={{ marginTop:8, padding:'8px 12px', background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:8, fontSize:12, color:'#92400E' }}>! {dupMsg}</div>
          )}
        </div>

        {/* Modal footer */}
        <div style={{ padding:'0 24px 20px', display:'flex', alignItems:'center', gap:9 }}>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display:'none' }} onChange={function(e) { handleFile(e.target.files[0]); }}/>
          <button onClick={function() { fileRef.current && fileRef.current.click(); }} disabled={uploading}
            style={{ padding:'9px 16px', borderRadius:9, border:'1px solid #E5E7EB', background:'white', fontSize:13, fontWeight:600, cursor:'pointer', color:'#374151', fontFamily:'inherit' }}>
            {uploading ? '... Reading...' : ' Upload JD File'}
          </button>
          <div style={{ flex:1 }}></div>
          <button onClick={onClose} style={{ padding:'9px 16px', borderRadius:9, border:'1px solid #E5E7EB', background:'white', fontSize:13, fontWeight:600, cursor:'pointer', color:'#374151', fontFamily:'inherit' }}>Cancel</button>
          <button onClick={function() { save(false); }} disabled={saving || parsing || !pasteText.trim()}
            style={{ padding:'9px 16px', borderRadius:9, border:'1px solid #E5E7EB', background:'white', fontSize:13, fontWeight:600, cursor:'pointer', color:'#374151', fontFamily:'inherit' }}>
            {saving ? 'Saving...' : 'Quick Save'}
          </button>
          <button onClick={function() { save(true); }} disabled={parsing || saving || !pasteText.trim()}
            style={{ padding:'10px 22px', borderRadius:9, border:'none', background:(parsing||saving||!pasteText.trim())?'#E5E7EB':'linear-gradient(135deg,#00C982,#009963)', color:(parsing||saving||!pasteText.trim())?'#9CA3AF':'white', fontSize:13, fontWeight:700, cursor:(parsing||saving||!pasteText.trim())?'not-allowed':'pointer', boxShadow:(parsing||saving||!pasteText.trim())?'none':'0 4px 12px rgba(0,201,130,.3)', fontFamily:'inherit' }}>
            {parsing ? '... Analyzing...' : '+ Analyze and Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const navigate = useNavigate();

  var [jds,         setJds]        = useState([]);
  var [baseResumes, setBaseResumes]= useState([]);
  var [loading,     setLoading]    = useState(true);
  var [selected,    setSelected]   = useState(null);
  var [filter,      setFilter]     = useState('all');
  var [showModal,   setShowModal]  = useState(false);

  useEffect(function() {
    Promise.all([jdApi.getAll(), resumeApi.getBase()])
      .then(function(results) { setJds(results[0] || []); setBaseResumes(results[1] || []); })
      .catch(console.error)
      .finally(function() { setLoading(false); });
  }, []);

  function handleSaved(saved) {
    setJds(function(prev) { return [saved, ...prev]; });
    setSelected(saved);
    setShowModal(false);
  }

  function handleStatusChange(jd, status) {
    jdApi.update(jd.id, { status: status }).then(function() {
      setJds(function(prev) { return prev.map(function(j) { return j.id === jd.id ? Object.assign({}, j, { status: status }) : j; }); });
      if (selected && selected.id === jd.id) setSelected(function(s) { return Object.assign({}, s, { status: status }); });
    }).catch(console.warn);
  }

  function handleDelete(jd) {
    if (!confirm('Delete this job description?')) return;
    jdApi.remove(jd.id).then(function() {
      setJds(function(prev) { return prev.filter(function(j) { return j.id !== jd.id; }); });
      if (selected && selected.id === jd.id) setSelected(null);
    }).catch(console.warn);
  }

  var filtered = filter === 'all' ? jds : jds.filter(function(j) { return j.status === filter; });

  var drag    = useDragResize({ initial:360, min:260, max:600, side:'left',  storageKey:'tf_jdpage_left' });
  var dragAI  = useDragResize({ initial:270, min:180, max:520, side:'right', storageKey:'tf_jdpage_ai' });

  return (
    <div style={{ display:'flex', height:'calc(100vh - 57px)', background:'#F5F7F5', fontFamily:'system-ui,sans-serif', position:'relative', paddingTop:52 }}>

      {/* JD Add Modal */}
      {showModal && (
        <AddJDModal
          onClose={function() { setShowModal(false); }}
          onSaved={handleSaved}
        />
      )}

      {/* Top header bar */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:52, background:'white', borderBottom:'1px solid #F0F0F0', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px 0 14px', zIndex:10, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#0D1B2A' }}>Job Descriptions</span>
          <span style={{ padding:'2px 9px', borderRadius:20, background:'#F3F4F6', color:'#6B7280', fontSize:11, fontWeight:600 }}>{jds.length}</span>
        </div>
        <button
          onClick={function() { setShowModal(true); }}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00C982,#009963)', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(0,201,130,.35)', fontFamily:'inherit', whiteSpace:'nowrap' }}
          onMouseEnter={function(e) { e.currentTarget.style.transform='scale(1.03)'; }}
          onMouseLeave={function(e) { e.currentTarget.style.transform='scale(1)'; }}>
          <span style={{ fontSize:18, lineHeight:1 }}>+</span>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:13, fontWeight:800, lineHeight:1.2 }}>Add Job Description</div>
            <div style={{ fontSize:10, opacity:.85, fontWeight:500 }}>Paste or upload a JD</div>
          </div>
        </button>
      </div>

      {/* Col 1: JD list — resizable */}
      <div style={{ width: drag.width, borderRight:'none', background:'white', display:'flex', flexDirection:'column', flexShrink:0, minWidth:0 }}>
        {/* List header */}
        <div style={{ padding:'10px 12px', borderBottom:'1px solid #F0F0F0', flexShrink:0 }}>
          <div style={{ display:'flex', gap:0, background:'#F3F4F6', borderRadius:8, padding:2 }}>
            {['all','saved','liked','applied','archived'].map(function(f) {
              return (
                <button key={f} onClick={function() { setFilter(f); }}
                  style={{ padding:'4px 8px', borderRadius:6, border:'none', fontSize:10, fontWeight:600, cursor:'pointer', background:filter===f?'white':'transparent', color:filter===f?'#0D1B2A':'#6B7280', fontFamily:'inherit', textTransform:'capitalize' }}>
                  {f}
                </button>
              );
            })}
            <span style={{ marginLeft:'auto', fontSize:11, color:'#9CA3AF', alignSelf:'center', paddingRight:4 }}>{filtered.length}</span>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {loading && <div style={{ padding:'40px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>Loading...</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ padding:'30px 16px', textAlign:'center' }}>
              <div style={{ fontSize:28, marginBottom:8 }}></div>
              <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>No job descriptions yet</div>
              <button onClick={function() { setShowModal(true); }}
                style={{ padding:'8px 16px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#00C982,#009963)', color:'white', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                + Add JD
              </button>
            </div>
          )}
          {filtered.map(function(jd) {
            var sc = STATUS_COLORS[jd.status] || STATUS_COLORS.saved;
            var isSelected = selected && selected.id === jd.id;
            return (
              <div key={jd.id} onClick={function() { setSelected(isSelected ? null : jd); }}
                style={{ padding:'11px 12px', borderRadius:10, marginBottom:6, cursor:'pointer', border:'1.5px solid ' + (isSelected ? G : '#F0F0F0'), background:isSelected ? '#F0FDF7' : 'white', transition:'all .15s' }}>
                <div style={{ display:'flex', gap:9 }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:'#0D1B2A', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:14, fontWeight:800, flexShrink:0 }}>
                    {(jd.company || jd.title || 'J').charAt(0)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#0D1B2A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{jd.title || 'Untitled JD'}</div>
                    <div style={{ fontSize:11, color:'#6B7280', marginBottom:5 }}>{jd.company}{jd.location ? ' . ' + jd.location : ''}</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:4 }}>
                      {(jd.skills_required || []).slice(0, 3).map(function(s) { return <span key={s} style={{ padding:'1px 7px', borderRadius:20, background:'#FEE2E2', color:'#991B1B', fontSize:10, fontWeight:600 }}>{s}</span>; })}
                      {(jd.skills_required || []).length > 3 && <span style={{ padding:'1px 7px', borderRadius:20, background:'#F3F4F6', color:'#6B7280', fontSize:10 }}>+{jd.skills_required.length - 3}</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ padding:'2px 7px', borderRadius:20, background:sc.bg, color:sc.color, fontSize:10, fontWeight:700 }}>{jd.status}</span>
                      <span style={{ fontSize:10, color:'#9CA3AF' }}>{new Date(jd.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</span>
                      {jd.match_score > 0 && <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, color:jd.match_score >= 80 ? G : '#F59E0B' }}>{jd.match_score}%</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drag handle */}
      <div {...drag.handleProps}/>

      {/* Col 2: JD detail */}
      <div style={{ flex:1, overflowY:'auto', background:'#F9FAFB', minWidth:0 }}>
        {selected ? (
          <JDDetailPanel
            jd={selected}
            onStatusChange={function(s) { handleStatusChange(selected, s); }}
            onDelete={function() { handleDelete(selected); }}
            onClose={function() { setSelected(null); }}
          />
        ) : (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'#9CA3AF' }}>
            <div style={{ fontSize:40, marginBottom:12 }}></div>
            <div style={{ fontSize:14, fontWeight:600, color:'#374151', marginBottom:4 }}>Select a job description</div>
            <div style={{ fontSize:12 }}>Click any JD from the list to view details</div>
          </div>
        )}
      </div>

      {/* Drag handle — col 2 / col 3 */}
      <div {...dragAI.handleProps}/>

      {/* Col 3: AI Tools — resizable */}
      <div style={{ width: dragAI.width, borderLeft:'none', background:'white', overflowY:'auto', flexShrink:0, minWidth:0 }}>
        <AIToolsSidebar jd={selected} baseResumes={baseResumes} onOptimize={function(jdId, resumeId) { navigate('/dashboard/optimizer?jd=' + jdId + '&resume=' + resumeId); }}/>
      </div>


    </div>
  );
}
