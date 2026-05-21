import { useState, useEffect, useRef } from 'react';
import { analysisApi } from '../../lib/api';

const G  = '#00C982';
const W  = '#F59E0B';
const R  = '#EF4444';

function scoreColor(s) {
  return s >= 70 ? G : s >= 45 ? W : R;
}

function Timer({ running }) {
  var [secs, setSecs] = useState(0);
  var ref = useRef(null);
  useEffect(function() {
    if (running) {
      setSecs(0);
      ref.current = setInterval(function() { setSecs(function(s) { return s + 1; }); }, 1000);
    } else {
      clearInterval(ref.current);
    }
    return function() { clearInterval(ref.current); };
  }, [running]);
  if (!running && secs === 0) return null;
  return <span style={{ fontSize:11, color:'#9CA3AF', marginLeft:6 }}>{secs}s</span>;
}

function ScoreRing({ score }) {
  var sc    = Math.round(score || 0);
  var size  = 110;
  var r     = size * 0.38;
  var circ  = 2 * Math.PI * r;
  var color = scoreColor(sc);
  var offset = circ - (sc / 100) * circ;
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={size * 0.08}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size * 0.08} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition:'stroke-dashoffset 1s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:size * 0.22, fontWeight:700, color:color, lineHeight:1 }}>{sc}%</span>
        <span style={{ fontSize:size * 0.1, color:'#9CA3AF' }}>match</span>
      </div>
    </div>
  );
}

export default function AnalysisStep({ resumeText, resumeParsed, jdText, jdParsed, onComplete, onBack, savedResult }) {
  // If parent already has a completed analysis, start in review mode immediately
  var [phase,     setPhase]    = useState(savedResult ? 'review' : 'idle');
  var [error,     setError]    = useState('');
  var [result,    setResult]   = useState(savedResult || null);
  var [confirmed, setConfirmed]= useState(function() {
    if (!savedResult) return [];
    return (savedResult.missingSkills || [])
      .filter(function(g) { return g.priority !== 'LOW'; })
      .map(function(g) { return g.skill || g; });
  });
  var [running,   setRunning]  = useState(false);

  async function runAnalysis() {
    setError('');
    setPhase('loading');
    setRunning(true);
    try {
      // Single combined call - gaps + bullets together
      var res = await analysisApi.gaps({ resumeText, resumeParsed, jdText, jdParsed });
      var data = res.data || res;

      // Pre-select HIGH + MEDIUM priority gaps
      var autoConfirmed = (data.missingSkills || [])
        .filter(function(g) { return g.priority !== 'LOW'; })
        .map(function(g) { return g.skill || g; });

      setResult(data);
      setConfirmed(autoConfirmed);
      setPhase('review');
    } catch (e) {
      setError(e.message || 'Analysis failed. Please try again.');
      setPhase('idle');
    } finally {
      setRunning(false);
    }
  }

  function toggleGap(skill) {
    setConfirmed(function(prev) {
      var idx = prev.indexOf(skill);
      if (idx >= 0) return prev.filter(function(g) { return g !== skill; });
      return prev.concat([skill]);
    });
  }

  function handleProceed() {
    var combined = {
      matchScore:    result.matchScore    || 0,
      industry:      result.industry      || '',
      yearsInResume: result.yearsInResume || 0,
      yearsInJD:     result.yearsInJD     || 0,
      matchedSkills: result.matchedSkills || [],
      missingSkills: (result.missingSkills || []).map(function(g) { return g.skill || g; }),
      gapDetails:    result.missingSkills || [],
      ecosystemGaps: (result.ecosystemGaps || []).map(function(g) { return g.name || g; }),
      keyThemes:     result.keyThemes     || [],
      roleAnalysis:  (result.roles || []).map(function(r, i) {
        var existingBullets = resumeParsed && resumeParsed.experiences && resumeParsed.experiences[r.roleIndex]
          ? (resumeParsed.experiences[r.roleIndex].bullets || [])
          : [];
        return {
          roleIndex:       r.roleIndex,
          company:         r.company,
          roleName:        r.roleName,
          dates:           r.dates,
          existingBullets: existingBullets,
          suggestedPoints: r.suggestedPoints || [],
        };
      }),
    };
    onComplete(combined, result);
  }

  var sc = result ? Math.round(result.matchScore || 0) : 0;

  return (
    <div style={{ background:'white', borderRadius:14, padding:'20px 22px', border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.05)', marginBottom:14 }}>
      <div style={{ fontSize:18, fontWeight:800, color:'#0D1B2A', marginBottom:4 }}>AI Analysis</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>One combined AI call - gap analysis and bullet generation together (faster).</div>

      {/* IDLE */}
      {phase === 'idle' && (
        <div>
          <div style={{ background:'#F9FAFB', borderRadius:12, padding:'14px 16px', border:'1px solid #F3F4F6', marginBottom:14 }}>
            <div style={{ display:'flex', gap:12, marginBottom:8 }}>
              <span style={{ fontSize:22 }}></span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#0D1B2A', marginBottom:2 }}>Combined Analysis</div>
                <div style={{ fontSize:11, color:'#6B7280' }}>One AI call computes match score, identifies gaps, and generates 8 targeted bullets per role. Typically 25-40 seconds.</div>
              </div>
            </div>
          </div>
          {error && (
            <div style={{ padding:'10px 13px', background:'#FEE2E2', border:'1px solid #FCA5A5', borderRadius:9, fontSize:12, color:'#991B1B', marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>{error}</span>
              <button onClick={runAnalysis} style={{ padding:'4px 10px', borderRadius:7, border:'none', background:'#991B1B', color:'white', fontSize:11, fontWeight:700, cursor:'pointer' }}>Retry</button>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <button onClick={onBack} style={{ padding:'9px 18px', borderRadius:9, border:'1px solid #E5E7EB', background:'white', fontSize:13, fontWeight:700, cursor:'pointer', color:'#374151', fontFamily:'inherit' }}>Back</button>
            <button onClick={runAnalysis} style={{ padding:'9px 22px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#00C982,#009963)', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
               Run Analysis
            </button>
          </div>
        </div>
      )}

      {/* LOADING */}
      {phase === 'loading' && (
        <div style={{ padding:'3rem 0', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
          <div style={{ width:40, height:40, border:'3px solid ' + G, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'#0D1B2A', display:'flex', alignItems:'center', justifyContent:'center' }}>
              Analyzing resume against JD...
              <Timer running={running}/>
            </div>
            <div style={{ fontSize:12, color:'#9CA3AF', marginTop:4 }}>Computing gaps and generating bullets in one pass</div>
          </div>
          <div style={{ fontSize:11, color:'#9CA3AF' }}>Typically 25-40 seconds - much faster than before</div>
        </div>
      )}

      {/* REVIEW */}
      {phase === 'review' && result && (
        <div>
          {/* Score + stats */}
          <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:12, marginBottom:12 }}>
            <div style={{ background:'#F9FAFB', borderRadius:12, padding:'12px', border:'1px solid #F3F4F6', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <ScoreRing score={sc}/>
            </div>
            <div>
              {result.yearsInJD > 0 && result.yearsInResume > 0 && result.yearsInResume < result.yearsInJD && (
                <div style={{ padding:'9px 12px', borderRadius:10, background:'#FEF3C7', border:'1px solid #FDE68A', marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#92400E' }}>! Experience gap: JD needs {result.yearsInJD}+ yrs, resume shows {result.yearsInResume}</div>
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  [(result.matchedSkills || []).length, 'Matched',  G],
                  [(result.missingSkills || []).length, 'Gaps',     R],
                  [(result.roles || []).length,          'Roles',   '#7C3AED'],
                  [confirmed.length,                    'Selected', G],
                ].map(function(item) {
                  return (
                    <div key={item[1]} style={{ background:'#F9FAFB', borderRadius:9, padding:'8px', textAlign:'center', border:'1px solid #F3F4F6' }}>
                      <div style={{ fontSize:18, fontWeight:700, color:item[2] }}>{item[0] || 0}</div>
                      <div style={{ fontSize:10, color:'#9CA3AF' }}>{item[1]}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Matched skills */}
          {(result.matchedSkills || []).length > 0 && (
            <div style={{ background:'#F9FAFB', borderRadius:10, padding:'11px', border:'1px solid #F3F4F6', marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6 }}>Matched v</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {(result.matchedSkills || []).map(function(s) {
                  return <span key={s} style={{ padding:'2px 8px', borderRadius:20, background:'#D1FAE5', color:'#059669', fontSize:11, fontWeight:600 }}>{s}</span>;
                })}
              </div>
            </div>
          )}

          {/* Gap review */}
          <div style={{ background:'#F9FAFB', borderRadius:10, padding:'11px', border:'1px solid #F3F4F6', marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.5px' }}>
                Gaps targeted in bullets ({confirmed.length} selected)
              </div>
              <div style={{ display:'flex', gap:5 }}>
                <button onClick={function() { setConfirmed((result.missingSkills || []).map(function(g) { return g.skill || g; })); }} style={{ fontSize:10, padding:'2px 8px', borderRadius:5, border:'1px solid #E5E7EB', background:'white', cursor:'pointer' }}>All</button>
                <button onClick={function() { setConfirmed([]); }} style={{ fontSize:10, padding:'2px 8px', borderRadius:5, border:'1px solid #E5E7EB', background:'white', cursor:'pointer' }}>None</button>
              </div>
            </div>
            {(result.missingSkills || []).map(function(g, i) {
              var skill   = g.skill || g;
              var checked = confirmed.indexOf(skill) >= 0;
              var pColor  = g.priority === 'HIGH' ? R : g.priority === 'MEDIUM' ? W : '#9CA3AF';
              return (
                <div
                  key={i}
                  onClick={function() { toggleGap(skill); }}
                  style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'7px 9px', borderRadius:8, marginBottom:4, cursor:'pointer', background:checked ? '#F0FDF7' : '#F9FAFB', border:'1px solid ' + (checked ? '#A7F3D0' : '#E5E7EB'), transition:'all .15s' }}>
                  <div style={{ width:16, height:16, borderRadius:4, flexShrink:0, marginTop:1, background:checked ? G : 'white', border:'1.5px solid ' + (checked ? G : '#D1D5DB'), display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:10 }}>
                    {checked ? 'v' : ''}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#0D1B2A' }}>{skill}</span>
                      {g.priority && <span style={{ fontSize:10, padding:'1px 5px', borderRadius:4, background:pColor + '20', color:pColor, fontWeight:700 }}>{g.priority}</span>}
                    </div>
                    {g.context && <div style={{ fontSize:11, color:'#6B7280', marginTop:1 }}>{g.context}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {result.overallRecommendation && (
            <div style={{ padding:'9px 12px', borderRadius:9, background:'#E6FAF2', border:'1px solid #A7F3D0', fontSize:12, color:'#065F46', lineHeight:1.6, marginBottom:12 }}>
               {result.overallRecommendation}
            </div>
          )}

          {/* Bullet preview */}
          <div style={{ background:'#F9FAFB', borderRadius:10, padding:'11px', border:'1px solid #F3F4F6', marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>
              Bullets generated - {(result.roles || []).reduce(function(s, r) { return s + (r.suggestedPoints || []).length; }, 0)} total
            </div>
            {(result.roles || []).slice(0, 2).map(function(role, ri) {
              return (
                <div key={ri} style={{ marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#0D1B2A', marginBottom:4 }}>
                    {role.roleName} <span style={{ color:G, fontWeight:400, fontSize:11 }}>- {role.company}</span>
                  </div>
                  {(role.suggestedPoints || []).slice(0, 2).map(function(p, pi) {
                    return (
                      <div key={pi} style={{ fontSize:11, color:'#374151', display:'flex', gap:5, marginBottom:3 }}>
                        <span style={{ padding:'1px 5px', borderRadius:4, fontSize:9, fontWeight:700, background:p.confidence === 'HIGH' ? '#D1FAE5' : '#FEF3C7', color:p.confidence === 'HIGH' ? '#059669' : '#92400E', flexShrink:0 }}>{p.confidence}</span>
                        <span>{p.text}</span>
                      </div>
                    );
                  })}
                  {(role.suggestedPoints || []).length > 2 && (
                    <div style={{ fontSize:10, color:'#9CA3AF' }}>+{role.suggestedPoints.length - 2} more in Preview step</div>
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <div style={{ padding:'10px 13px', background:'#FEE2E2', borderRadius:9, fontSize:12, color:'#991B1B', marginBottom:12 }}>{error}</div>
          )}

          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <button onClick={function() { setPhase('idle'); setResult(null); setConfirmed([]); }} style={{ padding:'9px 18px', borderRadius:9, border:'1px solid #E5E7EB', background:'white', fontSize:13, fontWeight:700, cursor:'pointer', color:'#374151', fontFamily:'inherit' }}>
              Re-run Analysis
            </button>
            <button onClick={handleProceed} style={{ padding:'9px 22px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#00C982,#009963)', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              View and Select Bullets
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
