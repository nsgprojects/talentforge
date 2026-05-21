import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jdApi, coverLetterApi } from '../../lib/api';

const G = '#00C982';
const GD = '#009963';

export default function AIToolsSidebar({ jd, baseResumes, onOptimize }) {
  const navigate = useNavigate();
  const [selectedResume, setSelectedResume] = useState('');
  const [showResumes,    setShowResumes]    = useState(false);
  const [fitResult,      setFitResult]      = useState(null);
  const [fitLoading,     setFitLoading]     = useState(false);
  const [coverLetter,    setCoverLetter]    = useState('');
  const [clLoading,      setCLLoading]      = useState(false);
  const [activePanel,    setActivePanel]    = useState('');
  const [copied,         setCopied]         = useState(false);

  // Set default selected resume when baseResumes loads
  const currentResume = selectedResume || (baseResumes.length > 0 ? baseResumes[0].id : '');

  async function handleAnalyzeFit() {
    if (!jd || !currentResume) return;
    setFitLoading(true);
    setActivePanel('fit');
    setFitResult(null);
    try {
      const r = await jdApi.analyzeFit(jd.id, currentResume);
      setFitResult(r.data);
    } catch (e) {
      alert(e.message);
    } finally {
      setFitLoading(false);
    }
  }

  async function handleGenerateCL() {
    if (!jd || !currentResume) return;
    setCLLoading(true);
    setActivePanel('cover');
    setCoverLetter('');
    try {
      const r = await coverLetterApi.generate({ jd_id: jd.id, base_resume_id: currentResume });
      setCoverLetter(r.data ? r.data.content : '');
    } catch (e) {
      alert(e.message);
    } finally {
      setCLLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCustomize() {
    setShowResumes(s => !s);
  }

  function handleSelectResume(resumeId) {
    setSelectedResume(resumeId);
    if (jd) {
      onOptimize(jd.id, resumeId);
    }
    setShowResumes(false);
  }

  if (!jd) {
    return (
      <div style={{ padding:'20px 16px', fontFamily:'system-ui,sans-serif' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:16 }}>AI Tools</div>
        <div style={{ padding:'30px 10px', textAlign:'center', color:'#9CA3AF', fontSize:12 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>+</div>
          <div>Select a job description to use AI tools</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:'16px', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:14 }}>AI Tools</div>

      {/* Customize Your Resume */}
      <div
        onClick={handleCustomize}
        style={{ background:'linear-gradient(135deg,#E6FAF2,#D1FAE5)', borderRadius:11, padding:'12px 14px', marginBottom:10, border:'1px solid #A7F3D0', cursor:'pointer' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:G, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ color:'white', fontSize:14 }}>+</span>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#0D1B2A' }}>Customize Your Resume</div>
            <div style={{ fontSize:11, color:'#6B7280' }}>Maximize your interview chances</div>
          </div>
          <span style={{ color:'#9CA3AF', fontSize:11 }}>{showResumes ? '^' : '>'}</span>
        </div>
      </div>

      {/* Resume list */}
      {showResumes && (
        <div style={{ background:'#F9FAFB', borderRadius:10, padding:'10px', border:'1px solid #E5E7EB', marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:8 }}>Choose base resume (last 20):</div>
          {baseResumes.length === 0 ? (
            <div style={{ fontSize:12, color:'#9CA3AF' }}>No base resumes. Upload one in Resumes tab.</div>
          ) : (
            <div style={{ maxHeight:280, overflowY:'auto', display:'flex', flexDirection:'column', gap:5 }}>
              {baseResumes.slice(0, 20).map(r => (
                <button
                  key={r.id}
                  onClick={() => handleSelectResume(r.id)}
                  style={{ padding:'9px 11px', borderRadius:8, border:'1.5px solid ' + (currentResume === r.id ? G : '#E5E7EB'), background:currentResume === r.id ? '#E6FAF2' : 'white', cursor:'pointer', textAlign:'left', fontFamily:'inherit', transition:'all .15s' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#0D1B2A' }}>{r.name}</div>
                  <div style={{ fontSize:10, color:'#9CA3AF' }}>V{r.version_number} . {r.tech_stack || 'General'}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resume selector for other tools */}
      {baseResumes.length > 0 && (
        <div style={{ marginBottom:10 }}>
          <label style={{ fontSize:11, color:'#6B7280', fontWeight:600, display:'block', marginBottom:4 }}>Using resume:</label>
          <select
            value={currentResume}
            onChange={e => setSelectedResume(e.target.value)}
            style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid #E5E7EB', fontSize:12, background:'white', color:'#374151', cursor:'pointer' }}>
            {baseResumes.slice(0, 20).map(r => (
              <option key={r.id} value={r.id}>{r.name} (V{r.version_number})</option>
            ))}
          </select>
        </div>
      )}

      {/* Build Cover Letter */}
      <button
        onClick={handleGenerateCL}
        disabled={clLoading || !currentResume}
        style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1px solid #E5E7EB', background:'white', fontSize:13, fontWeight:700, cursor:(clLoading || !currentResume) ? 'not-allowed' : 'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:10, fontFamily:'inherit', marginBottom:8, opacity:(clLoading || !currentResume) ? 0.6 : 1 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:'#F3F4F6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}></div>
        <div style={{ flex:1, textAlign:'left' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#374151' }}>{clLoading ? 'Writing...' : 'Build Cover Letter'}</div>
          <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:400 }}>Make your application stand out</div>
        </div>
      </button>

      {/* Analyze Fit */}
      <button
        onClick={handleAnalyzeFit}
        disabled={fitLoading || !currentResume}
        style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1px solid #E5E7EB', background:'white', fontSize:13, fontWeight:700, cursor:(fitLoading || !currentResume) ? 'not-allowed' : 'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:10, fontFamily:'inherit', marginBottom:14, opacity:(fitLoading || !currentResume) ? 0.6 : 1 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:'#F3F4F6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}></div>
        <div style={{ flex:1, textAlign:'left' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#374151' }}>{fitLoading ? 'Analyzing...' : 'Analyze How Well You Fit'}</div>
          <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:400 }}>Understand your strength and weakness</div>
        </div>
      </button>

      {/* Fit result */}
      {activePanel === 'fit' && (
        <div style={{ background:'#F9FAFB', borderRadius:11, padding:'13px', border:'1px solid #F0F0F0', marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#0D1B2A', marginBottom:8 }}>Fit Analysis</div>
          {fitLoading && <div style={{ textAlign:'center', color:'#9CA3AF', padding:'16px', fontSize:12 }}>Analyzing...</div>}
          {fitResult && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
                {[
                  ['Overall',    fitResult.overallScore,    '#0D1B2A'],
                  ['Experience', fitResult.experienceScore, G],
                  ['Skills',     fitResult.skillScore,      '#7C3AED'],
                  ['Industry',   fitResult.industryScore,   '#F59E0B'],
                ].map(function(item) {
                  return (
                    <div key={item[1] + item[0]} style={{ textAlign:'center', padding:'7px', background:'white', borderRadius:8, border:'1px solid #F0F0F0' }}>
                      <div style={{ fontSize:17, fontWeight:800, color:item[2] }}>{item[1] || 0}%</div>
                      <div style={{ fontSize:10, color:'#9CA3AF' }}>{item[0]}</div>
                    </div>
                  );
                })}
              </div>
              {fitResult.recommendation && (
                <div style={{ fontSize:11, color:'#374151', lineHeight:1.6, padding:'8px', background:'#E6FAF2', borderRadius:7 }}>
                   {fitResult.recommendation}
                </div>
              )}
              {fitResult.matchedSkills && fitResult.matchedSkills.length > 0 && (
                <div style={{ marginTop:9 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', marginBottom:5 }}>Matched</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {fitResult.matchedSkills.slice(0, 8).map(s => (
                      <span key={s} style={{ padding:'2px 7px', borderRadius:20, background:'#D1FAE5', color:'#059669', fontSize:10, fontWeight:600 }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {fitResult.missingSkills && fitResult.missingSkills.length > 0 && (
                <div style={{ marginTop:7 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', marginBottom:5 }}>Missing</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {fitResult.missingSkills.slice(0, 6).map(s => (
                      <span key={s} style={{ padding:'2px 7px', borderRadius:20, background:'#FEE2E2', color:'#991B1B', fontSize:10, fontWeight:600 }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cover letter result */}
      {activePanel === 'cover' && (
        <div style={{ background:'#F9FAFB', borderRadius:11, padding:'13px', border:'1px solid #F0F0F0' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#0D1B2A', marginBottom:8 }}>Cover Letter</div>
          {clLoading && <div style={{ textAlign:'center', color:'#9CA3AF', padding:'16px', fontSize:12 }}>Writing...</div>}
          {coverLetter && (
            <div>
              <div style={{ fontSize:11, color:'#374151', lineHeight:1.7, maxHeight:260, overflowY:'auto', whiteSpace:'pre-wrap', marginBottom:8, padding:'8px', background:'white', borderRadius:7, border:'1px solid #F0F0F0' }}>
                {coverLetter}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button
                  onClick={handleCopy}
                  style={{ flex:1, padding:'6px', borderRadius:7, border:'1px solid #E5E7EB', background:'white', fontSize:11, fontWeight:600, cursor:'pointer', color:copied ? GD : '#374151' }}>
                  {copied ? 'v Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleGenerateCL}
                  style={{ flex:1, padding:'6px', borderRadius:7, border:'none', background:G, color:'white', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
