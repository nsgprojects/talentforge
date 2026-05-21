import { useState } from 'react';

const G = '#00C982';

export default function JDDetailPanel({ jd, onStatusChange, onDelete, onClose }) {
  const [tab, setTab] = useState('overview');

  var parsed       = jd && jd.parsed_json ? jd.parsed_json : {};
  var required     = jd && jd.skills_required  ? jd.skills_required  : (parsed.required  || []);
  var preferred    = jd && jd.skills_preferred ? jd.skills_preferred : (parsed.preferred || []);
  var resps        = parsed.responsibilities || [];
  var benefits     = parsed.benefits || [];
  var matchScore   = (jd && jd.match_score) ? jd.match_score : 0;

  if (!jd) return null;

  return (
    <div style={{ fontFamily:'system-ui,sans-serif', height:'100%', overflowY:'auto' }}>
      {/* Header */}
      <div style={{ background:'white', padding:'14px 20px', borderBottom:'1px solid #F0F0F0', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
          <button onClick={onClose} style={{ fontSize:11, color:'#9CA3AF', border:'none', background:'transparent', cursor:'pointer', padding:0 }}>x Close</button>
          <select
            value={jd.status}
            onChange={e => onStatusChange(e.target.value)}
            style={{ fontSize:11, border:'1px solid #E5E7EB', borderRadius:7, padding:'4px 8px', background:'white', cursor:'pointer' }}>
            <option value="saved">Saved</option>
            <option value="liked">Liked</option>
            <option value="applied">Applied</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div style={{ padding:'16px 20px' }}>
        {/* Company + title */}
        <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:14 }}>
          <div style={{ width:46, height:46, borderRadius:12, background:'#0D1B2A', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:18, fontWeight:800, flexShrink:0 }}>
            {(jd.company || jd.title || 'J').charAt(0)}
          </div>
          <div style={{ flex:1 }}>
            {jd.company && <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:2 }}>{jd.company}</div>}
            <div style={{ fontSize:18, fontWeight:800, color:'#0D1B2A', marginBottom:6 }}>{jd.title || 'Untitled'}</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:10, fontSize:12, color:'#6B7280' }}>
              {jd.location           && <span> {jd.location}</span>}
              {parsed.workType       && <span> {parsed.workType}</span>}
              {jd.experience_req     && <span> {jd.experience_req}</span>}
              {parsed.seniority      && <span> {parsed.seniority}</span>}
            </div>
          </div>
        </div>

        {/* Match score */}
        {matchScore > 0 && (
          <div style={{ background:'#0D1B2A', borderRadius:13, padding:'14px 16px', marginBottom:14, display:'grid', gridTemplateColumns:'auto 1fr', gap:16, alignItems:'center' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:36, fontWeight:800, color:G, lineHeight:1 }}>{matchScore}%</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.5)', fontWeight:700, textTransform:'uppercase' }}>MATCH</div>
            </div>
            <div>
              <div style={{ fontSize:12, color:'white', fontWeight:700, marginBottom:4 }}>Strong Match</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.6)' }}>Based on your base resume</div>
            </div>
          </div>
        )}

        {/* H1B badge */}
        {parsed.h1bSponsorship && (
          <div style={{ marginBottom:12 }}>
            <span style={{ padding:'3px 10px', borderRadius:20, background:'#D1FAE5', color:'#059669', fontSize:11, fontWeight:700 }}>v H1B Sponsor Likely</span>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'2px solid #F0F0F0', marginBottom:14 }}>
          {['overview', 'company'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ padding:'8px 16px', border:'none', background:'transparent', fontSize:13, fontWeight:tab === t ? 700 : 500, color:tab === t ? '#0D1B2A' : '#9CA3AF', borderBottom:tab === t ? '2px solid #0D1B2A' : '2px solid transparent', marginBottom:-2, cursor:'pointer', textTransform:'capitalize', fontFamily:'inherit' }}>
              {t}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div>
            {parsed.summary && (
              <div style={{ fontSize:13, color:'#374151', lineHeight:1.7, marginBottom:14 }}>{parsed.summary}</div>
            )}

            {required.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:800, color:'#0D1B2A', marginBottom:8 }}> Required Skills</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                  {required.map(s => (
                    <span key={s} style={{ padding:'4px 11px', borderRadius:20, background:'#D1FAE5', color:'#059669', fontSize:12, fontWeight:600 }}> {s}</span>
                  ))}
                </div>
                {required.map((s, i) => (
                  <div key={i} style={{ display:'flex', gap:8, fontSize:13, color:'#374151', marginBottom:4 }}>
                    <span>-</span><span>{s}</span>
                  </div>
                ))}
              </div>
            )}

            {preferred.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:800, color:'#0D1B2A', marginBottom:8 }}> Preferred Skills</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                  {preferred.map(s => (
                    <span key={s} style={{ padding:'4px 11px', borderRadius:20, background:'#F3F4F6', color:'#374151', fontSize:12 }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {resps.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:800, color:'#0D1B2A', marginBottom:8 }}> Responsibilities</div>
                {resps.map((r, i) => (
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:6, fontSize:13, color:'#374151', lineHeight:1.6 }}>
                    <span style={{ flexShrink:0 }}>-</span><span>{r}</span>
                  </div>
                ))}
              </div>
            )}

            {benefits.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:800, color:'#0D1B2A', marginBottom:8 }}> Benefits</div>
                {benefits.map((b, i) => (
                  <div key={i} style={{ display:'flex', gap:8, fontSize:13, color:'#374151', marginBottom:4 }}>
                    <span style={{ color:G }}>v</span><span>{b}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Company */}
        {tab === 'company' && (
          <div>
            {parsed.company ? (
              <div style={{ background:'#F9FAFB', borderRadius:12, padding:'16px', border:'1px solid #F0F0F0' }}>
                <div style={{ fontSize:16, fontWeight:700, color:'#0D1B2A', marginBottom:4 }}>{parsed.company}</div>
                {parsed.industry && <div style={{ fontSize:12, color:G, marginBottom:10 }}>{parsed.industry}</div>}
                <div style={{ fontSize:12, color:'#6B7280', lineHeight:1.7 }}>
                  Company information is extracted from the job description. Paste the full JD including the company overview section for more details.
                </div>
              </div>
            ) : (
              <div style={{ padding:'30px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>No company data in this JD.</div>
            )}
          </div>
        )}

        {/* Delete */}
        <div style={{ marginTop:20, paddingTop:12, borderTop:'1px solid #F0F0F0' }}>
          <button
            onClick={onDelete}
            style={{ fontSize:11, color:'#EF4444', border:'none', background:'transparent', cursor:'pointer', textDecoration:'underline' }}>
            Delete this JD
          </button>
        </div>
      </div>
    </div>
  );
}
