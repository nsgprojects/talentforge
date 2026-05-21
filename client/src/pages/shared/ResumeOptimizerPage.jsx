import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { resumeApi, jdApi } from '../../lib/api';
import JDSelectStep     from '../optimizer/JDSelectStep';
import ResumeSelectStep from '../optimizer/ResumeSelectStep';
import AnalysisStep     from '../optimizer/AnalysisStep';
import PreviewStep      from '../optimizer/PreviewStep';
import ExportStep       from '../optimizer/ExportStep';

const G = '#00C982';
const SESSION_KEY = 'tf_optimizer_session';

const STEPS = [
  { id:1, label:'Job Description' },
  { id:2, label:'Resume'          },
  { id:3, label:'AI Analysis'     },
  { id:4, label:'Preview'         },
  { id:5, label:'Export'          },
];

function reconstructResumeText(parsed) {
  if (!parsed) return '';
  if (parsed.rawText) return parsed.rawText;
  var lines = [];
  if (parsed.summary || parsed.name) {
    lines.push('CANDIDATE: ' + (parsed.name || ''));
    if (parsed.summary) lines.push('SUMMARY: ' + parsed.summary);
  }
  if (parsed.skills) {
    if (Array.isArray(parsed.skills)) {
      lines.push('SKILLS: ' + parsed.skills.join(', '));
    } else if (typeof parsed.skills === 'object') {
      Object.entries(parsed.skills).forEach(function(e) {
        if (e[1] && e[1].length > 0) lines.push(e[0] + ': ' + (Array.isArray(e[1]) ? e[1].join(', ') : e[1]));
      });
    }
  }
  if (parsed.experiences && parsed.experiences.length > 0) {
    parsed.experiences.forEach(function(e) {
      lines.push('\nROLE: ' + (e.role || e.title || '') + ' at ' + (e.company || '') + ' (' + (e.dates || '') + ')');
      if (e.bullets && e.bullets.length > 0) {
        e.bullets.forEach(function(b) { if (b) lines.push('- ' + b); });
      }
    });
  }
  if (parsed.certifications && parsed.certifications.length > 0) {
    lines.push('\nCERTIFICATIONS: ' + parsed.certifications.map(function(c) { return c.name || c; }).join(', '));
  }
  return lines.join('\n');
}

function reconstructJDText(parsed, rawText) {
  if (rawText && rawText.length > 100) return rawText;
  if (!parsed) return '';
  var lines = [];
  if (parsed.title)               lines.push('JOB TITLE: ' + parsed.title);
  if (parsed.company)             lines.push('COMPANY: ' + parsed.company);
  if (parsed.experienceRequired)  lines.push('EXPERIENCE REQUIRED: ' + parsed.experienceRequired);
  if (parsed.summary)             lines.push('SUMMARY: ' + parsed.summary);
  if (parsed.required   && parsed.required.length   > 0) lines.push('REQUIRED SKILLS: '   + parsed.required.join(', '));
  if (parsed.preferred  && parsed.preferred.length  > 0) lines.push('PREFERRED SKILLS: '  + parsed.preferred.join(', '));
  if (parsed.responsibilities && parsed.responsibilities.length > 0) {
    lines.push('RESPONSIBILITIES:');
    parsed.responsibilities.forEach(function(r) { lines.push('- ' + r); });
  }
  return lines.join('\n');
}

function empty() {
  return {
    step: 1,
    // JD
    jdId: null, jdParsed: null, jdText: '',
    // Resume
    baseResumeId: null, resumeParsed: null, resumeText: '', docxBase64: null,
    extractedExps: [], detectedFormat: 'E', originalFileName: '',
    // Analysis — persisted so Back does NOT re-fire Claude
    analysis: null, analysisRaw: null,
    // Preview — persisted so Back restores bullet selections
    selectedByRole: [], previewSelections: {},
    // Export — persisted so Back shows result without re-generating
    exportResult: null,
  };
}

// Lightweight session save: skip large blobs (docxBase64) to stay under storage limits
function saveSession(state) {
  try {
    var toSave = Object.assign({}, state);
    // Skip heavy base64 fields — re-fetched from DB if needed
    toSave.docxBase64 = null;
    if (toSave.exportResult) {
      toSave.exportResult = Object.assign({}, toSave.exportResult, {
        resultDocxBase64: null,
      });
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(toSave));
  } catch (_) {}
}

function loadSession() {
  try {
    var raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    var s = JSON.parse(raw);
    // Only restore if session has meaningful progress (at least step 2 done)
    if (!s || s.step < 2) return null;
    return s;
  } catch (_) { return null; }
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
}

export default function ResumeOptimizerPage() {
  var [searchParams] = useSearchParams();
  var [state,        setState]       = useState(empty());
  var [jdPool,       setJdPool]      = useState([]);
  var [resumePool,   setResumePool]  = useState([]);
  var [loadingPools, setLoadingPools]= useState(true);
  var [resumeBanner, setResumeBanner]= useState(false); // "resume session?" banner
  var resumeBannerDismissed = useRef(false);

  var {
    step, jdId, jdParsed, jdText,
    baseResumeId, resumeParsed, resumeText, docxBase64, extractedExps, detectedFormat, originalFileName,
    analysis, analysisRaw, selectedByRole, previewSelections, exportResult,
  } = state;

  var set = function(updates) {
    setState(function(s) {
      var next = Object.assign({}, s, updates);
      saveSession(next);
      return next;
    });
  };

  // Load pools
  useEffect(function() {
    Promise.all([jdApi.getAll(), resumeApi.getBase()])
      .then(function(results) { setJdPool(results[0] || []); setResumePool(results[1] || []); })
      .catch(console.error)
      .finally(function() { setLoadingPools(false); });
  }, []);

  // Check for resumable session on mount
  useEffect(function() {
    if (resumeBannerDismissed.current) return;
    var saved = loadSession();
    if (saved && saved.step > 1) setResumeBanner(true);
  }, []);

  // URL param pre-fill
  useEffect(function() {
    var jdParam     = searchParams.get('jd');
    var resumeParam = searchParams.get('resume');
    if (jdParam && !jdId) {
      jdApi.getById(jdParam).then(function(jd) {
        set({ jdId: jd.id, jdParsed: jd.parsed_json || {}, jdText: jd.raw_text || '', step: resumeParam ? 2 : 1 });
      }).catch(function() {});
    }
    if (resumeParam && !baseResumeId) {
      resumeApi.getBaseById(resumeParam).then(function(r) {
        set({ baseResumeId: r.id, resumeParsed: r.content || {}, resumeText: r.content && r.content.rawText ? r.content.rawText : (r.summary_text || ''), docxBase64: r.original_file_b64 || null, originalFileName: r.original_file_name || '' });
      }).catch(function() {});
    }
  }, [searchParams]);

  var go = function(n) { set({ step: n }); };

  var reset = function() {
    clearSession();
    setResumeBanner(false);
    setState(empty());
  };

  var restoreSession = function() {
    var saved = loadSession();
    if (saved) {
      setState(saved);
      setResumeBanner(false);
    }
  };

  var dismissBanner = function() {
    resumeBannerDismissed.current = true;
    setResumeBanner(false);
  };

  // Stepper: only allow navigating to completed steps (step < current)
  // Never allow jumping forward past current step
  var handleStepClick = function(targetStep) {
    if (targetStep < step) go(targetStep);
    // clicking current or future step does nothing
  };

  var resumeEffectiveText = resumeText && resumeText.length > 100
    ? resumeText
    : reconstructResumeText(resumeParsed);
  var jdEffectiveText = jdText && jdText.length > 50
    ? jdText
    : reconstructJDText(jdParsed, jdText);

  return (
    <div style={{ padding:'20px 24px', minHeight:'calc(100vh - 57px)', background:'#F5F7F5', fontFamily:'system-ui,sans-serif' }}>

      {/* Resume-session banner */}
      {resumeBanner && (
        <div style={{ padding:'12px 16px', background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:10, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#92400E', marginBottom:2 }}>Resume previous session?</div>
            <div style={{ fontSize:11, color:'#6B7280' }}>You have an optimizer session in progress. Continue where you left off or start fresh.</div>
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <button onClick={restoreSession} style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#F59E0B', color:'white', fontSize:12, fontWeight:700, cursor:'pointer' }}>Resume</button>
            <button onClick={dismissBanner}  style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', fontSize:12, cursor:'pointer', color:'#374151' }}>Start fresh</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, color:'#0D1B2A', margin:0 }}>Resume Optimizer</h1>
          <p style={{ fontSize:12, color:'#9CA3AF', margin:'2px 0 0' }}>AI-powered ATS optimization - JD to Resume to Analyze to Export</p>
        </div>
        {step > 1 && (
          <button onClick={reset} style={{ fontSize:11, color:'#9CA3AF', border:'1px solid #E5E7EB', background:'white', borderRadius:7, padding:'5px 11px', cursor:'pointer' }}>
            Start over
          </button>
        )}
      </div>

      {/* Progress stepper */}
      <div style={{ background:'white', borderRadius:12, padding:'12px 18px', border:'1px solid #F0F0F0', marginBottom:18, display:'flex', alignItems:'center' }}>
        {STEPS.map(function(s, i) {
          var done   = s.id < step;
          var active = s.id === step;
          var future = s.id > step;
          return (
            <div key={s.id} style={{ display:'flex', alignItems:'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <button
                onClick={function() { handleStepClick(s.id); }}
                title={future ? 'Complete current step to unlock' : done ? 'Go back to ' + s.label : ''}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 8px', border:'none', background:'transparent', cursor: done ? 'pointer' : 'default', fontFamily:'inherit' }}>
                <div style={{
                  width:30, height:30, borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, fontWeight:700,
                  background: active ? G : done ? '#D1FAE5' : '#F3F4F6',
                  color:      active ? 'white' : done ? '#059669' : '#9CA3AF',
                  border:    '2px solid ' + (active ? G : done ? '#A7F3D0' : '#E5E7EB'),
                  opacity:    future ? 0.5 : 1,
                }}>
                  {done ? 'v' : s.id}
                </div>
                <span style={{ fontSize:10, fontWeight: active ? 700 : 400, color: active ? '#0D1B2A' : done ? '#059669' : '#9CA3AF', whiteSpace:'nowrap', opacity: future ? 0.5 : 1 }}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div style={{ flex:1, height:2, background: done ? G : '#F3F4F6', borderRadius:99, margin:'0 2px', marginBottom:16, transition:'background .4s' }}/>
              )}
            </div>
          );
        })}
      </div>

      {/* Pre-fill banner */}
      {jdParsed && jdParsed.title && step === 1 && (
        <div style={{ padding:'9px 13px', background:'#E6FAF2', border:'1px solid #A7F3D0', borderRadius:9, marginBottom:12, fontSize:12, color:'#059669', fontWeight:600 }}>
          Pre-loaded from Jobs/JDs: "{jdParsed.title}" at {jdParsed.company || 'Company'} - confirm or change below
        </div>
      )}

      <div style={{ maxWidth:860, margin:'0 auto' }}>

        {/* Step 1 */}
        {step === 1 && (
          <JDSelectStep
            jdPool={jdPool}
            loadingPools={loadingPools}
            prefillJd={jdParsed ? { id:jdId, parsed:jdParsed, raw_text:jdText } : null}
            onComplete={function(jdData) {
              set({ jdId: jdData.id || null, jdParsed: jdData.parsed, jdText: jdData.raw_text || '', step: 2 });
            }}
          />
        )}

        {/* Step 2 */}
        {step === 2 && (
          <ResumeSelectStep
            resumePool={resumePool}
            loadingPools={loadingPools}
            prefillResume={baseResumeId ? {
              id:               baseResumeId,
              parsed:           resumeParsed,
              rawText:          resumeText,
              docxBase64:       docxBase64,
              detectedFormat:   detectedFormat,
              originalFileName: originalFileName,
              extractedExps:    extractedExps,
            } : null}
            onComplete={function(rd) {
              // Changing resume clears downstream analysis + export so they re-run fresh
              set({
                baseResumeId:  rd.id           || null,
                resumeParsed:  rd.parsed,
                resumeText:    rd.rawText       || '',
                docxBase64:    rd.docxBase64    || null,
                extractedExps: rd.extractedExps || [],
                detectedFormat:rd.detectedFormat|| 'E',
                originalFileName: rd.originalFileName || '',
                // Reset downstream only if resume actually changed
                analysis:          rd.id !== baseResumeId ? null : analysis,
                analysisRaw:       rd.id !== baseResumeId ? null : analysisRaw,
                previewSelections: rd.id !== baseResumeId ? {} : previewSelections,
                selectedByRole:    rd.id !== baseResumeId ? [] : selectedByRole,
                exportResult:      rd.id !== baseResumeId ? null : exportResult,
                step: 3,
              });
            }}
            onBack={function() { go(1); }}
          />
        )}

        {/* Step 3 */}
        {step === 3 && (
          <AnalysisStep
            resumeText={resumeEffectiveText}
            resumeParsed={resumeParsed}
            jdText={jdEffectiveText}
            jdParsed={jdParsed}
            savedResult={analysisRaw}
            onComplete={function(combined, raw) {
              set({ analysis: combined, analysisRaw: raw || combined, step: 4 });
            }}
            onBack={function() { go(2); }}
          />
        )}

        {/* Step 4 */}
        {step === 4 && analysis && (
          <PreviewStep
            analysis={analysis}
            savedSelections={previewSelections}
            onComplete={function(pts, selections) {
              set({ selectedByRole: pts, previewSelections: selections || {}, step: 5 });
            }}
            onBack={function() { go(3); }}
          />
        )}

        {/* Step 5 */}
        {step === 5 && (
          <ExportStep
            resumeText={resumeText}
            resumeParsed={resumeParsed}
            originalDocxBase64={docxBase64}
            extractedExperiences={extractedExps}
            detectedFormat={detectedFormat}
            selectedPointsByRole={selectedByRole}
            analysis={analysis}
            baseResumeId={baseResumeId}
            targetTitle={jdParsed && jdParsed.title}
            targetCompany={jdParsed && jdParsed.company}
            jdParsed={jdParsed}
            gapAnalysis={analysis}
            savedResult={exportResult}
            onResultReady={function(res) { set({ exportResult: res }); }}
            onBack={function() { go(4); }}
            onReset={reset}
          />
        )}
      </div>
    </div>
  );
}
