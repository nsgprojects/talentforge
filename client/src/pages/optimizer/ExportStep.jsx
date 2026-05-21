import { useState } from 'react';
import { integrateApi, exportApi, resumeApi, pointsApi } from '../../lib/api';
import BeforeAfterDashboard from './BeforeAfterDashboard';

const G='#00C982',GD='#009963';
const Btn=({onClick,disabled,children,outline,style={}})=>(
  <button onClick={onClick} disabled={disabled} style={{padding:'9px 18px',borderRadius:9,border:outline?'1px solid #E5E7EB':'none',background:disabled?'#E5E7EB':outline?'white':'linear-gradient(135deg,#00C982,#009963)',color:disabled?'#9CA3AF':outline?'#374151':'white',fontSize:13,fontWeight:700,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',...style}}>{children}</button>
);

export default function ExportStep({ resumeText, resumeParsed, originalDocxBase64, extractedExperiences, detectedFormat, selectedPointsByRole, analysis, onBack, onReset, baseResumeId, targetTitle, targetCompany, jdParsed, gapAnalysis, savedResult, onResultReady }) {
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  // Restore saved result immediately — no re-generate needed when coming back from Back
  const [result,    setResult]    = useState(savedResult || null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(!!(savedResult));
  const [dlDocx,    setDlDocx]    = useState(false);

  const totalPoints = (selectedPointsByRole||[]).reduce((s,r)=>s+(r.bullets||[]).length, 0);

  const integrate = async () => {
    setError(''); setLoading(true);
    try {
      const res = await integrateApi.run({ resumeText, resumeParsed, selectedPointsByRole, extractedExperiences, detectedFormat, originalDocxBase64 });
      setResult(res.data);
      // Persist result to parent so Back/Forward doesn't require re-generating
      if (onResultReady) onResultReady(res.data);

      // Auto-save to DB
      setSaving(true);
      try {
        // Save bullet points to library
        const allPoints = selectedPointsByRole.flatMap(r=>(r.bullets||[]).map(b=>({ content:b, stack_label:resumeParsed?.skills?.[0]||'General', experience_role:r.roleName })));
        if (allPoints.length>0) await pointsApi.saveBatch({ points:allPoints });

        // Save tailored resume
        if (baseResumeId) {
          await resumeApi.saveTailored({
            base_resume_id: baseResumeId,
            name: `${targetTitle||'Role'} @ ${targetCompany||'Company'}`,
            target_company: targetCompany,
            target_title: targetTitle,
            job_description: jdParsed?.summary||'',
            jd_parsed: jdParsed||{},
            gap_analysis: gapAnalysis||{},
            selected_points: selectedPointsByRole,
            content: { generatedPoints: selectedPointsByRole },
            match_score: analysis?.matchScore||0,
            ats_score_before: resumeParsed?.atsScore||0,
            ats_score_after: Math.min(100, (analysis?.matchScore||0) + 15),
            result_docx_b64: res.data.resultDocxBase64||null,
          });
          setSaved(true);
        }
      } catch(saveErr) { console.warn('Save warning:', saveErr.message); }
      finally { setSaving(false); }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const downloadDocx = async () => {
    if (!result) return; setDlDocx(true);
    try {
      if (result.resultDocxBase64) await exportApi.docxFromBase64(result.resultDocxBase64);
    } catch(e) { setError('Download failed: '+e.message); }
    finally { setDlDocx(false); }
  };
  const downloadTxt = () => result?.integratedResume && exportApi.txt(result.integratedResume);

  if (result) return <BeforeAfterDashboard originalText={resumeText} result={result} selectedPointsByRole={selectedPointsByRole} analysis={analysis} dlDocx={dlDocx} saved={saved} onDownloadDocx={downloadDocx} onDownloadTxt={downloadTxt} error={error} onBack={onBack} onReset={onReset}/>;

  const card = { background:'white', borderRadius:14, padding:'20px 22px', border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.05)', marginBottom:16 };

  return (
    <div style={card}>
      <div style={{fontSize:18,fontWeight:800,color:'#0D1B2A',margin:'0 0 4px',letterSpacing:'-.3px'}}>Confirm &amp; Export</div>
      <div style={{fontSize:13,color:'#6B7280',margin:'0 0 16px'}}>{originalDocxBase64?'Your original DOCX will be used - fonts, spacing, tables, and layout preserved exactly.':'Text mode - points will be integrated into resume text.'}</div>

      {originalDocxBase64 ? (
        <div style={{padding:'11px 14px',borderRadius:10,background:'#D1FAE5',border:'1px solid #A7F3D0',display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <span style={{fontSize:20}}></span>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:'#059669'}}>DOCX mode active</div>
            <div style={{fontSize:11,color:'#374151'}}>Bullets inserted directly into original file - formatting unchanged via Python</div>
          </div>
        </div>
      ) : (
        <div style={{padding:'12px 14px',borderRadius:10,background:'#FEF3C7',border:'1px solid #FDE68A',marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:'#92400E',marginBottom:3}}>! No original DOCX in session</div>
          <div style={{fontSize:11,color:'#374151',lineHeight:1.6}}>Upload your resume as a DOCX file in Step 1 to preserve all original formatting. Text mode will output plain text only.</div>
        </div>
      )}

      <div style={{padding:'12px 14px',borderRadius:10,background:'#E6FAF2',border:'1px solid #A7F3D0',marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:'#0D1B2A',marginBottom:2}}>{totalPoints} points ready across {(selectedPointsByRole||[]).filter(r=>r.bullets?.length).length} roles</div>
        <div style={{fontSize:11,color:'#6B7280'}}>Points will be scattered at random positions within each role's responsibilities section</div>
      </div>

      {(selectedPointsByRole||[]).map((role,ri)=>role.bullets?.length>0&&(
        <div key={ri} style={{background:'#F9FAFB',borderRadius:10,padding:'11px 13px',border:'1px solid #F3F4F6',marginBottom:8}}>
          <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:8}}>
            <div style={{width:3,height:18,background:G,borderRadius:99,flexShrink:0}}/>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:'#0D1B2A'}}>{role.roleName}</div>
              <div style={{fontSize:11,color:'#9CA3AF'}}>{role.company}</div>
            </div>
            <span style={{marginLeft:'auto',padding:'2px 9px',borderRadius:20,background:'#EDE9FE',color:'#7C3AED',fontSize:11,fontWeight:700}}>{role.bullets.length} pts</span>
          </div>
          {role.bullets.map((b,bi)=>(
            <div key={bi} style={{display:'flex',gap:7,padding:'5px 9px',borderRadius:7,border:'1px solid #A7F3D0',background:'#F0FDF7',color:'#059669',fontSize:11,lineHeight:1.5,marginBottom:4}}>
              <span style={{flexShrink:0}}>+</span><span>{b}</span>
            </div>
          ))}
        </div>
      ))}

      {error&&<div style={{padding:'10px 13px',background:'#FEE2E2',border:'1px solid #FCA5A5',borderRadius:9,fontSize:12,color:'#991B1B',marginBottom:12}}>{error}</div>}

      <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
        <Btn onClick={onBack} outline>Back</Btn>
        <Btn onClick={integrate} disabled={loading}>{loading?'... Integrating...':' Generate final resume ->'}</Btn>
      </div>
    </div>
  );
}
