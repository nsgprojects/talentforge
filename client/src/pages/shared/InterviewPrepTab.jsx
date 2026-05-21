import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { interviewApi } from '../../lib/api';

const G  = '#00C982';
const GD = '#009963';
const DK = '#0D1B2A';

var TIER_META = {
  screener: { label:'Screener', color:'#3B82F6', bg:'#DBEAFE', desc:'Quick phone filter — 5 min' },
  technical:{ label:'Technical', color:'#7C3AED', bg:'#EDE9FE', desc:'Validates real hands-on depth' },
  client:   { label:'Client-Ready', color:GD, bg:'#D1FAE5', desc:'First round — what clients ask' },
};

function Spinner() {
  return (
    <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}>
      <div style={{ width:28, height:28, border:'3px solid '+G, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
    </div>
  );
}

function QuestionCard({ q, index }) {
  var [open,   setOpen]   = useState(false);
  var [copied, setCopied] = useState(false);
  var tm = TIER_META[q.tier] || TIER_META.technical;

  var copy = function(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(q.q).then(function() {
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 2000);
    });
  };

  return (
    <div style={{ borderRadius:10, border:'1.5px solid '+(open?G:'#E5E7EB'), marginBottom:8, overflow:'hidden', transition:'border-color .15s' }}>
      <div onClick={function() { setOpen(!open); }}
        style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 14px', cursor:'pointer', background:open?'#F0FDF7':'white' }}>
        <div style={{ width:22, height:22, borderRadius:6, background:tm.bg, color:tm.color, fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
          {index+1}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:DK, lineHeight:1.5 }}>{q.q}</div>
          <span style={{ display:'inline-block', marginTop:4, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700, background:tm.bg, color:tm.color }}>
            {tm.label}
          </span>
        </div>
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          <button onClick={copy}
            style={{ padding:'4px 11px', borderRadius:7, border:'1px solid #E5E7EB', background:copied?'#D1FAE5':'white', fontSize:11, fontWeight:600, cursor:'pointer', color:copied?GD:'#374151', fontFamily:'inherit' }}>
            {copied?'Copied':'Copy'}
          </button>
          <div style={{ width:20, height:20, display:'flex', alignItems:'center', justifyContent:'center', color:'#9CA3AF', fontSize:12, marginTop:2 }}>
            {open?'v':'>'}
          </div>
        </div>
      </div>
      {open && (
        <div style={{ padding:'0 14px 14px', background:'white', borderTop:'1px solid #F0F0F0' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
            <div style={{ padding:'11px 13px', background:'#F0FDF7', borderRadius:9, border:'1px solid #A7F3D0' }}>
              <div style={{ fontSize:10, fontWeight:700, color:GD, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:5 }}>Strong answer looks like</div>
              <div style={{ fontSize:12, color:'#374151', lineHeight:1.6 }}>{q.good}</div>
            </div>
            <div style={{ padding:'11px 13px', background:'#FEF2F2', borderRadius:9, border:'1px solid #FCA5A5' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#DC2626', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:5 }}>Red flag signals</div>
              <div style={{ fontSize:12, color:'#374151', lineHeight:1.6 }}>{q.flag}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

var CHECKLISTS = {
  'devops-sre':       ['Has managed PRODUCTION Kubernetes clusters (not just dev)?','Can name their CI/CD tool and describe a pipeline they built?','Holds AWS/Azure/GCP cert or actively in progress?','Comfortable with on-call rotation — ask directly?','W2 or C2C confirmed with their corp?'],
  'cloud-architect':  ['Holds Solutions Architect Professional or Azure Expert cert?','Has led a full cloud migration (not just participated)?','Has designed multi-account org or Landing Zone?','Comfortable presenting to CTO/C-suite?','Available for on-site client visits if required?'],
  'java-backend':     ['On Java 11+ (ideally 17+) in current role?','Working with Spring Boot 3.x?','Has microservices production experience (not monolith only)?','Comfortable with code reviews and mentoring?','W2 or C2C — corp-to-corp vendor confirmed?'],
  'python-dev':       ['Python 3.9+ in current role?','Has FastAPI or Django production API experience?','Familiar with async/await (not just synchronous Python)?','Has written tests (pytest) for their code?','Open to fullstack if needed (light frontend)?'],
  'fullstack':        ['React 17+ and Node.js both in production?','TypeScript experience on both frontend and backend?','Has built and consumed REST APIs end-to-end?','Comfortable with Git branching and PR workflows?','Has AWS or Azure cloud deployment experience?'],
  'ml-ai':            ['Has deployed an ML model to production (not just notebooks)?','Specific framework: TensorFlow or PyTorch in production?','LLM or RAG experience (not just API usage)?','Comfortable with MLOps tooling (MLflow, W&B, SageMaker)?','PhD or MS in CS/Stats/Math — required for this role?'],
  'cybersecurity':    ['Holds active CISSP, CEH, OSCP, or CompTIA Security+?','Has worked in a SOC or incident response role?','Clearance required — do they hold one?','Has cloud security experience (AWS Security Hub, Azure Defender)?','Comfortable with regulatory compliance (HIPAA, PCI, SOC2)?'],
  'salesforce':       ['Holds Platform Developer I or II cert?','Has LWC (Lightning Web Component) production experience?','Using Salesforce DX and source-driven development?','Has integration experience (REST, middleware, Platform Events)?','Experience with CPQ or Experience Cloud?'],
  'scrum-master':     ['Holds PSM, CSM, or SAFe cert?','Has been SM for 2+ teams simultaneously?','Experience with Azure DevOps or Jira for sprint tracking?','Has scaled Agile experience (SAFe, LeSS, or Nexus)?','Technical background (former developer/QA) — required?'],
  'platform-engineer':['Has built or managed an Internal Developer Platform?','Backstage or similar developer portal experience?','Kubernetes multi-cluster management experience?','Experience with GitOps and self-service environment provisioning?','Familiarity with FinOps tools (Kubecost, OpenCost)?'],
  'dba':              ['Expert in PostgreSQL administration at production scale?','Has set up streaming replication and automatic failover?','Experience with Flyway or Liquibase for migrations?','Has conducted a database performance tuning engagement?','Oracle RAC experience required for this role?'],
};

export default function InterviewPrepTab() {
  var { user }  = useAuth();
  var isAdmin   = user && user.role === 'admin';

  var CACHE_KEY = 'tf_interview_questions';
  var getCached = function() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      // Cache interview questions for 1 day
      if (Date.now() - obj.ts > 24*60*60*1000) return null;
      return obj.data;
    } catch (_) { return null; }
  };
  var setCache  = function(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch (_) {}
  };

  var [roles,     setRoles]     = useState(getCached() || []);
  var [loading,   setLoading]   = useState(!getCached());
  var [activeRole,setRole]      = useState('devops-sre');
  var [tierFilter,setTier]      = useState('all');
  var [search,    setSearch]    = useState('');
  var [checkboxes,setChecks]    = useState({});
  var [copying,   setCopying]   = useState(false);
  var [refreshing,setRefreshing]= useState(false);
  var [toast,     setToast]     = useState(null);

  var load = useCallback(function(force) {
    setLoading(true);
    interviewApi.getAll()
      .then(function(data) {
        setRoles(data || []);
        setCache(data);
      })
      .catch(console.error)
      .finally(function() { setLoading(false); });
  }, []);

  useEffect(function() {
    if (!getCached()) load();
  }, []);

  var roleData = roles.find(function(r) { return r.roleId === activeRole; });
  var questions = roleData ? (Array.isArray(roleData.questions) ? roleData.questions : []) : [];

  var filtered = questions.filter(function(q) {
    if (tierFilter !== 'all' && q.tier !== tierFilter) return false;
    if (search && !q.q.toLowerCase().includes(search.toLowerCase()) &&
        !(q.good||'').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  var copyAll = function() {
    if (!filtered.length) return;
    setCopying(true);
    var text = (roleData ? roleData.roleLabel : activeRole) + ' — Interview Questions\n\n';
    ['screener','technical','client'].forEach(function(tier) {
      var items = filtered.filter(function(q) { return q.tier === tier; });
      if (!items.length) return;
      var tm = TIER_META[tier];
      text += '=== ' + tm.label + ' Questions (' + tm.desc + ') ===\n\n';
      items.forEach(function(q, i) {
        text += (i+1) + '. ' + q.q + '\n';
        text += '   Good answer: ' + (q.good||'') + '\n';
        text += '   Red flag: '    + (q.flag||'') + '\n\n';
      });
    });
    navigator.clipboard.writeText(text).then(function() {
      setToast('Copied ' + filtered.length + ' questions to clipboard');
      setTimeout(function() { setToast(null); setCopying(false); }, 3000);
    });
  };

  var refreshRole = function() {
    setRefreshing(true);
    localStorage.removeItem(CACHE_KEY);
    interviewApi.refreshRole(activeRole)
      .then(function() { load(true); setToast('Questions refreshed with latest AI data'); })
      .catch(function(e) { setToast('Refresh failed: ' + e.message); })
      .finally(function() { setRefreshing(false); setTimeout(function() { setToast(null); }, 5000); });
  };

  var toggleCheck = function(i) {
    var key = activeRole + ':' + i;
    setChecks(function(c) { return Object.assign({},c,{[key]:!c[key]}); });
  };
  var clearChecks = function() {
    var next = Object.assign({}, checkboxes);
    (CHECKLISTS[activeRole]||[]).forEach(function(_, i) { delete next[activeRole+':'+i]; });
    setChecks(next);
  };

  var checklist = CHECKLISTS[activeRole] || [];
  var daysOld   = roleData ? Math.floor((Date.now() - new Date(roleData.refreshedAt).getTime()) / (1000*60*60*24)) : null;

  var screenerCount  = filtered.filter(function(q) { return q.tier==='screener'; }).length;
  var technicalCount = filtered.filter(function(q) { return q.tier==='technical'; }).length;
  var clientCount    = filtered.filter(function(q) { return q.tier==='client'; }).length;

  return (
    <div>
      {/* Role selector */}
      <div style={{ background:'white', borderRadius:14, border:'1px solid #F0F0F0', padding:'16px 18px', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,.04)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:DK }}>Interview Question Bank</div>
            <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>
              180 questions across 10 roles — refreshed from top US tech companies every 15 days
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {isAdmin && (
              <button onClick={refreshRole} disabled={refreshing}
                style={{ padding:'7px 14px', borderRadius:9, border:'1px solid #E5E7EB', background:'white', fontSize:12, fontWeight:600, cursor:refreshing?'not-allowed':'pointer', color:'#374151', fontFamily:'inherit' }}>
                {refreshing?'Refreshing...':'Refresh with AI'}
              </button>
            )}
            <button onClick={copyAll} disabled={copying||!filtered.length}
              style={{ padding:'7px 16px', borderRadius:9, border:'none', background:'linear-gradient(135deg,'+G+','+GD+')', color:'white', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {copying?'Copied!':'Copy All Questions'}
            </button>
          </div>
        </div>

        {/* Role buttons */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {roles.length === 0 && !loading && (
            <div style={{ fontSize:12, color:'#9CA3AF' }}>No roles loaded — check server connection</div>
          )}
          {roles.map(function(r) {
            var isAct = activeRole === r.roleId;
            return (
              <button key={r.roleId} onClick={function() { setRole(r.roleId); setSearch(''); setTier('all'); }}
                style={{ padding:'6px 14px', borderRadius:20, border:'1.5px solid '+(isAct?G:'#E5E7EB'), background:isAct?'#F0FDF7':'white', fontSize:12, fontWeight:isAct?700:500, cursor:'pointer', color:isAct?GD:DK, fontFamily:'inherit', transition:'all .15s', whiteSpace:'nowrap' }}>
                {r.roleLabel}
              </button>
            );
          })}
        </div>
      </div>

      {toast && (
        <div style={{ padding:'9px 14px', background:'#D1FAE5', border:'1px solid #A7F3D0', borderRadius:9, fontSize:12, color:GD, fontWeight:600, marginBottom:12 }}>
          {toast}
        </div>
      )}

      {loading ? <Spinner/> : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:14 }}>
          {/* Left: questions */}
          <div>
            {/* Filter bar */}
            <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
              <input value={search} onChange={function(e) { setSearch(e.target.value); }}
                placeholder="Search questions..."
                style={{ flex:1, minWidth:180, padding:'8px 12px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:12, outline:'none', fontFamily:'inherit' }}
                onFocus={function(e) { e.target.style.borderColor=G; }} onBlur={function(e) { e.target.style.borderColor='#E5E7EB'; }}/>
              <div style={{ display:'flex', gap:0, background:'#F3F4F6', borderRadius:9, padding:3 }}>
                {[['all','All ('+filtered.length+')'],['screener','Screener ('+screenerCount+')'],['technical','Technical ('+technicalCount+')'],['client','Client-Ready ('+clientCount+')']].map(function(t) {
                  return (
                    <button key={t[0]} onClick={function() { setTier(t[0]); }}
                      style={{ padding:'5px 11px', borderRadius:7, border:'none', fontSize:11, fontWeight:600, cursor:'pointer', background:tierFilter===t[0]?'white':'transparent', color:tierFilter===t[0]?DK:'#6B7280', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                      {t[1]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Refresh badge */}
            {roleData && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <span style={{ fontSize:11, color:'#9CA3AF' }}>
                  Last updated {daysOld === 0 ? 'today' : daysOld + ' days ago'}
                </span>
                <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700, background:roleData.refreshSource==='claude'?'#D1FAE5':'#F3F4F6', color:roleData.refreshSource==='claude'?GD:'#6B7280' }}>
                  {roleData.refreshSource === 'claude' ? 'AI-refreshed' : 'Static baseline'}
                </span>
                {daysOld >= 15 && (
                  <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700, background:'#FEF3C7', color:'#92400E' }}>
                    Refresh due
                  </span>
                )}
              </div>
            )}

            {/* Questions */}
            {filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px', color:'#9CA3AF', fontSize:13 }}>
                {search ? 'No questions match your search' : 'No questions available for this role'}
              </div>
            ) : (
              filtered.map(function(q, i) { return <QuestionCard key={i} q={q} index={i}/>; })
            )}
          </div>

          {/* Right: submission checklist */}
          <div>
            <div style={{ background:'white', borderRadius:14, border:'1px solid #F0F0F0', padding:'16px 18px', position:'sticky', top:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:800, color:DK }}>Submission Checklist</div>
                {Object.keys(checkboxes).some(function(k) { return k.startsWith(activeRole+':'); }) && (
                  <button onClick={clearChecks}
                    style={{ fontSize:11, color:'#9CA3AF', border:'none', background:'none', cursor:'pointer', fontFamily:'inherit' }}>
                    Clear
                  </button>
                )}
              </div>
              <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:12 }}>
                Verify before submitting to client
              </div>
              {checklist.map(function(item, i) {
                var key = activeRole + ':' + i;
                var done = !!checkboxes[key];
                return (
                  <div key={i} onClick={function() { toggleCheck(i); }}
                    style={{ display:'flex', gap:9, padding:'9px 10px', borderRadius:9, marginBottom:6, cursor:'pointer', background:done?'#F0FDF7':'#F9FAFB', border:'1px solid '+(done?'#A7F3D0':'#F0F0F0'), transition:'all .15s' }}>
                    <div style={{ width:18, height:18, borderRadius:5, flexShrink:0, border:'2px solid '+(done?G:'#D1D5DB'), background:done?G:'white', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:11, marginTop:1 }}>
                      {done && 'v'}
                    </div>
                    <span style={{ fontSize:11, color:done?GD:'#374151', lineHeight:1.5, fontWeight:done?600:400 }}>{item}</span>
                  </div>
                );
              })}
              <div style={{ marginTop:14, padding:'10px 12px', background:'#F9FAFB', borderRadius:9, border:'1px solid #F0F0F0' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:5 }}>Quick tip</div>
                <div style={{ fontSize:11, color:'#374151', lineHeight:1.6 }}>
                  Ask Tier 1 (Screener) questions in the first 5 minutes. If the candidate cannot answer 3 of 5, end the call politely — do not proceed to technical questions.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
