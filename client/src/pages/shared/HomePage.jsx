import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { resumeApi, jdApi, pointsApi } from '../../lib/api';
import InterviewPrepTab from './InterviewPrepTab';

const G  = '#00C982';
const GD = '#009963';
const DK = '#0D1B2A';

// ── Cache helpers ─────────────────────────────────────────
function getCached(key, maxAgeMs) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (Date.now() - obj.ts > maxAgeMs) return null;
    return obj.data;
  } catch (_) { return null; }
}
function setCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch (_) {}
}

// ── Shared UI atoms ───────────────────────────────────────
function Card({ children, style }) {
  return (
    <div style={Object.assign({ background:'white', borderRadius:14, border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.04)', padding:'20px 22px' }, style)}>
      {children}
    </div>
  );
}
function SectionTitle({ children, sub, action }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:14 }}>
      <div>
        <div style={{ fontSize:15, fontWeight:800, color:DK }}>{children}</div>
        {sub && <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}
function Tag({ children, color, bg }) {
  return (
    <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700, background:bg||'#F3F4F6', color:color||'#6B7280' }}>
      {children}
    </span>
  );
}
function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 0' }}>
      <div style={{ width:28, height:28, border:'3px solid '+G, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MODULE 1 — Recruiter Command Center
// ═══════════════════════════════════════════════════════════
function CommandCenter({ jds, resumes, points }) {
  var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  var jdsThisWeek      = jds.filter(function(j) { return new Date(j.created_at) > weekAgo; }).length;
  var resumesTotal     = resumes.length;
  var pointsTotal      = points.length;
  var appliedThisWeek  = jds.filter(function(j) { return j.status === 'applied' && new Date(j.updated_at) > weekAgo; }).length;
  var avgATS = resumes.length > 0
    ? Math.round(resumes.reduce(function(s, r) { return s + (r.ats_score || 0); }, 0) / resumes.length)
    : 0;

  var stats = [
    { label:'JDs This Week',     value:jdsThisWeek,   color:'#3B82F6', icon:'', sub:'new job descriptions' },
    { label:'Base Resumes',      value:resumesTotal,  color:G,         icon:'', sub:'in your library' },
    { label:'Bullets Saved',     value:pointsTotal,   color:'#7C3AED', icon:'', sub:'in points library' },
    { label:'Applied This Week', value:appliedThisWeek,color:'#F59E0B',icon:'', sub:'applications sent' },
    { label:'Avg ATS Score',     value:avgATS > 0 ? avgATS+'%' : '-', color:'#EF4444', icon:'', sub:'across all resumes' },
  ];

  return (
    <Card style={{ padding:'16px 20px' }}>
      <SectionTitle sub="Your activity this week">Recruiter Command Center</SectionTitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
        {stats.map(function(s) {
          return (
            <div key={s.label} style={{ background:'#F9FAFB', borderRadius:11, padding:'14px 12px', border:'1px solid #F0F0F0', textAlign:'center' }}>
              <div style={{ fontSize:11, marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontSize:22, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value !== undefined && s.value !== null ? s.value : '-'}</div>
              <div style={{ fontSize:11, fontWeight:600, color:DK, marginTop:4 }}>{s.label}</div>
              <div style={{ fontSize:10, color:'#9CA3AF', marginTop:1 }}>{s.sub}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// MODULE 2 — Market Pulse (Claude, cached 24h)
// ═══════════════════════════════════════════════════════════
function MarketPulse() {
  var CACHE_KEY = 'tf_market_pulse';
  var [data,    setData]    = useState(function() { return getCached(CACHE_KEY, 24*60*60*1000); });
  var [loading, setLoading] = useState(!getCached(CACHE_KEY, 24*60*60*1000));
  var [error,   setError]   = useState('');

  var STATIC_FALLBACK = {
    topSkills: ['Kubernetes','Terraform','AWS','Python','Azure DevOps','Docker','React','GitOps','Helm','Ansible'],
    hotTitles: ['Platform Engineer','Sr. DevOps/SRE','AI/ML Engineer','Cloud Architect','Fullstack (React+Node)'],
    insight: 'Contract DevOps and SRE roles continue to dominate IT staffing demand. Cloud-native skills (K8s, Terraform, GitOps) command 15-25% rate premiums. AI/ML Engineering is the fastest-growing title, with demand up sharply YoY. Remote-first roles have stabilized at around 60% of new IT postings.'
  };

  useEffect(function() {
    if (data) { setLoading(false); return; }
    var token = localStorage.getItem('tf_token');
    if (!token) { setData(STATIC_FALLBACK); setLoading(false); return; }

    fetch('/api/home/market-pulse', { headers:{ Authorization:'Bearer '+token } })
      .then(function(r) { return r.json(); })
      .then(function(r) {
        var d = r.data || STATIC_FALLBACK;
        setCache(CACHE_KEY, d);
        setData(d);
      })
      .catch(function() {
        setData(STATIC_FALLBACK);
      })
      .finally(function() { setLoading(false); });
  }, []);

  var cached = getCached(CACHE_KEY, 24*60*60*1000);

  return (
    <Card>
      <SectionTitle
        sub="US IT hiring trends — refreshed daily"
        action={
          <button onClick={function() { localStorage.removeItem(CACHE_KEY); setData(null); setLoading(true); window.location.reload(); }}
            style={{ fontSize:11, color:'#9CA3AF', border:'1px solid #E5E7EB', background:'white', borderRadius:7, padding:'3px 9px', cursor:'pointer' }}>
            Refresh
          </button>
        }>
        US IT Market Pulse
      </SectionTitle>
      {loading ? <Spinner/> : (
        <div>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>
              Top In-Demand Skills
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {(data && data.topSkills ? data.topSkills : STATIC_FALLBACK.topSkills).map(function(s, i) {
                var colors = [
                  ['#D1FAE5','#059669'],['#DBEAFE','#1D4ED8'],['#EDE9FE','#7C3AED'],
                  ['#FEF3C7','#92400E'],['#FCE7F3','#9D174D']
                ];
                var c = colors[i % colors.length];
                return <Tag key={s} bg={c[0]} color={c[1]}>{s}</Tag>;
              })}
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>
              Hottest Job Titles Right Now
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {(data && data.hotTitles ? data.hotTitles : STATIC_FALLBACK.hotTitles).map(function(t, i) {
                return (
                  <div key={t} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'#F9FAFB', borderRadius:8, border:'1px solid #F0F0F0' }}>
                    <div style={{ width:20, height:20, borderRadius:6, background:G, color:'white', fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i+1}</div>
                    <span style={{ fontSize:12, fontWeight:600, color:DK }}>{t}</span>
                    {i === 0 && <Tag bg="#D1FAE5" color="#059669">Trending</Tag>}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ padding:'11px 13px', background:'#E6FAF2', borderRadius:9, border:'1px solid #A7F3D0' }}>
            <div style={{ fontSize:11, fontWeight:700, color:GD, marginBottom:3 }}>Market Insight</div>
            <div style={{ fontSize:12, color:'#374151', lineHeight:1.6 }}>
              {data && data.insight ? data.insight : STATIC_FALLBACK.insight}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// MODULE 3 — IT Skills Quick-Reference
// ═══════════════════════════════════════════════════════════
var SKILLS_DATA = [
  {
    cat:'Cloud Platforms', icon:'',
    items:[
      { name:'AWS', desc:'Amazon Web Services — dominant in enterprise. Key services: EC2, S3, Lambda, RDS, EKS. If a JD says "cloud experience" without specifying, assume AWS.', seniority:'Mid-Senior', salary:'$110-160k FTE', freq:'Very High' },
      { name:'Azure', desc:'Microsoft cloud — dominant in enterprise Windows shops and govt. Key: AKS, Azure DevOps, ARM Templates, ADFS. Strong in financial & healthcare sectors.', seniority:'Mid-Senior', salary:'$105-155k FTE', freq:'Very High' },
      { name:'GCP', desc:'Google Cloud — strong in startups and data-heavy orgs. Key: BigQuery, GKE, Vertex AI. Often seen alongside Kubernetes roles.', seniority:'Mid-Senior', salary:'$115-165k FTE', freq:'High' },
      { name:'OpenStack', desc:'Private cloud platform. Used by telecoms and govt. Less common in 2024 but still active in large enterprises avoiding public cloud.', seniority:'Senior', salary:'$120-160k FTE', freq:'Medium' },
    ]
  },
  {
    cat:'CI/CD Tools', icon:'',
    items:[
      { name:'Jenkins', desc:'Open-source CI/CD server. The most common legacy tool. If a JD lists Jenkins, the team is likely established/enterprise. Often paired with Maven and Ansible.', seniority:'Mid', salary:'$100-140k FTE', freq:'Very High' },
      { name:'GitHub Actions', desc:'Native CI/CD inside GitHub repos. Preferred in startups and modern teams. Replacing Jenkins rapidly. Much simpler pipeline syntax (YAML).', seniority:'Mid', salary:'$105-145k FTE', freq:'High' },
      { name:'Azure DevOps', desc:'Microsoft all-in-one: repos, pipelines, boards, artifacts. Common in Azure-heavy shops. Also called VSTS/TFS (older names).', seniority:'Mid', salary:'$105-145k FTE', freq:'High' },
      { name:'ArgoCD', desc:'GitOps continuous delivery for Kubernetes. Declarative — the cluster automatically matches what is in git. Signal of a modern, K8s-native team.', seniority:'Senior', salary:'$130-170k FTE', freq:'Growing' },
    ]
  },
  {
    cat:'Containers', icon:'',
    items:[
      { name:'Docker', desc:'Container runtime. Creates lightweight, portable app packages. Almost universal — nearly every DevOps JD lists it. Not the same as a VM: containers share the host OS kernel.', seniority:'Mid', salary:'$100-140k FTE', freq:'Very High' },
      { name:'Kubernetes', desc:'Container orchestration. Manages clusters of Docker containers at scale. K8s = industry standard for production workloads. CKA/CKAD certs are highly valued.', seniority:'Senior', salary:'$130-175k FTE', freq:'Very High' },
      { name:'OpenShift', desc:'RedHat enterprise Kubernetes with extra security and compliance layers. Common in government, finance, healthcare. More opinionated than vanilla K8s.', seniority:'Senior', salary:'$125-170k FTE', freq:'Medium' },
      { name:'Helm', desc:'Package manager for Kubernetes (like npm for K8s). Manages complex app deployments via "charts." Signal that the team is doing serious K8s production work.', seniority:'Senior', salary:'$130-175k FTE', freq:'High' },
    ]
  },
  {
    cat:'Languages', icon:'',
    items:[
      { name:'Python', desc:'Dominant in DevOps scripting, ML/AI, data engineering, and backend APIs. The most versatile language in IT staffing. "Python scripting" = automation; "Python backend" = FastAPI/Django/Flask.', seniority:'All levels', salary:'$105-155k FTE', freq:'Very High' },
      { name:'Java', desc:'Enterprise backend workhorse. Spring Boot is the standard framework. Java devs are senior and command high rates. "J2EE" = older enterprise apps. Still heavily used in banking and insurance.', seniority:'Mid-Senior', salary:'$110-160k FTE', freq:'Very High' },
      { name:'JavaScript/TypeScript', desc:'Fullstack language. Node.js for backend, React/Angular/Vue for frontend. TypeScript adds type safety — preferred in enterprise. If JD says "MEAN/MERN stack" this is it.', seniority:'All levels', salary:'$100-150k FTE', freq:'Very High' },
      { name:'Go (Golang)', desc:'Compiled language by Google. Used in cloud-native tools (K8s itself is in Go), high-performance microservices. Signal of a sophisticated engineering team. Niche but growing.', seniority:'Senior', salary:'$130-175k FTE', freq:'Medium' },
    ]
  },
  {
    cat:'Monitoring', icon:'',
    items:[
      { name:'Datadog', desc:'SaaS observability platform. APM, infrastructure monitoring, log management. Very common in cloud-native orgs. High cost = well-funded company. Good proxy for team maturity.', seniority:'Mid-Senior', salary:'$115-155k FTE', freq:'High' },
      { name:'Splunk', desc:'Enterprise log analysis and SIEM. Heavy in finance, healthcare, government. Splunk certs are valued. Expensive licensing = large enterprise only.', seniority:'Mid-Senior', salary:'$115-160k FTE', freq:'High' },
      { name:'Prometheus + Grafana', desc:'Open-source monitoring stack. Prometheus collects metrics; Grafana visualizes them. Standard in K8s environments. Always seen together.', seniority:'Mid-Senior', salary:'$110-155k FTE', freq:'Very High' },
      { name:'ELK Stack', desc:'Elasticsearch + Logstash + Kibana. Open-source log aggregation and search. The self-hosted alternative to Splunk/Datadog. Often called "ELK" or "Elastic Stack."', seniority:'Mid', salary:'$105-145k FTE', freq:'High' },
    ]
  },
  {
    cat:'Certifications', icon:'',
    items:[
      { name:'AWS-SAA', desc:'AWS Certified Solutions Architect – Associate. Most common AWS cert. Validates broad cloud architecture knowledge. Required in many enterprise JDs. 3-year validity.', seniority:'Mid', salary:'+$10-20k premium', freq:'Very High' },
      { name:'CKA', desc:'Certified Kubernetes Administrator. Hands-on exam — no MCQ, only live cluster tasks. High signal for real K8s operators. Very respected in SRE/DevOps hiring.', seniority:'Senior', salary:'+$15-25k premium', freq:'High' },
      { name:'CKAD', desc:'Certified Kubernetes Application Developer. Focused on deploying apps on K8s rather than administering clusters. Pairs with CKA for complete K8s coverage.', seniority:'Mid-Senior', salary:'+$10-20k premium', freq:'Medium' },
      { name:'Azure Architect Expert', desc:'Microsoft Certified: Azure Solutions Architect Expert. Two-exam path (AZ-104 + AZ-305). High value in Azure shops. Harder to obtain than AWS-SAA.', seniority:'Senior', salary:'+$15-25k premium', freq:'High' },
    ]
  },
  {
    cat:'Databases', icon:'',
    items:[
      { name:'PostgreSQL', desc:'Open-source relational DB. The default choice for new applications. "Postgres" on a JD signals a modern, pragmatic team. Often paired with Python (FastAPI/Django).', seniority:'Mid', salary:'$100-140k FTE', freq:'Very High' },
      { name:'MongoDB', desc:'Document database (NoSQL). Flexible schema = faster iteration. Popular in startups and MEAN/MERN stacks. If JD says "NoSQL experience," this is usually what they mean.', seniority:'Mid', salary:'$100-140k FTE', freq:'High' },
      { name:'Redis', desc:'In-memory key-value store. Used for caching, session management, pub/sub. Almost never a primary DB — always supporting another DB. Signal of a performance-conscious team.', seniority:'Mid-Senior', salary:'$110-150k FTE', freq:'High' },
      { name:'Cassandra', desc:'Distributed NoSQL DB. Used for massive-scale, high-write workloads (IoT, telemetry, analytics). Niche — signal of very large-scale systems (Netflix, Apple, Uber).', seniority:'Senior', salary:'$125-165k FTE', freq:'Low-Medium' },
    ]
  },
  {
    cat:'IaC Tools', icon:'',
    items:[
      { name:'Terraform', desc:'HashiCorp infrastructure-as-code. The dominant IaC tool. Cloud-agnostic (works on AWS, Azure, GCP). HCL syntax. Nearly universal in DevOps roles — if it is in the JD, it is probably required, not optional.', seniority:'Mid-Senior', salary:'$120-165k FTE', freq:'Very High' },
      { name:'Ansible', desc:'Configuration management and automation. Agentless (uses SSH). YAML playbooks. Often paired with Terraform: Terraform provisions infra, Ansible configures it.', seniority:'Mid', salary:'$105-145k FTE', freq:'Very High' },
      { name:'Pulumi', desc:'Modern IaC using real programming languages (Python, TypeScript, Go) instead of HCL. Gaining traction in developer-led orgs. Signal of a forward-looking engineering culture.', seniority:'Senior', salary:'$125-165k FTE', freq:'Low-Growing' },
      { name:'CloudFormation', desc:'AWS-native IaC. JSON/YAML templates that provision AWS resources. AWS-only (unlike Terraform). Often seen in older AWS shops or orgs standardizing on AWS ecosystem.', seniority:'Mid', salary:'$105-145k FTE', freq:'Medium' },
    ]
  },
];

function SkillsReference() {
  var [search,   setSearch]   = useState('');
  var [expanded, setExpanded] = useState(null);
  var [activeTab, setTab]     = useState(0);

  var filtered = SKILLS_DATA.filter(function(cat) {
    if (!search) return true;
    var q = search.toLowerCase();
    return cat.cat.toLowerCase().includes(q) || cat.items.some(function(it) {
      return it.name.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q);
    });
  });

  var freqColor = function(f) {
    if (f === 'Very High' || f === 'Growing') return ['#D1FAE5','#059669'];
    if (f === 'High')   return ['#DBEAFE','#1D4ED8'];
    if (f === 'Medium') return ['#FEF3C7','#92400E'];
    return ['#F3F4F6','#6B7280'];
  };

  return (
    <Card>
      <SectionTitle sub="Click any skill for full details, seniority signal, and salary range">IT Skills Quick-Reference</SectionTitle>
      <input
        value={search} onChange={function(e) { setSearch(e.target.value); setTab(0); }}
        placeholder="Search skills, tools, or categories..."
        style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit', marginBottom:12, transition:'border-color .15s' }}
        onFocus={function(e) { e.target.style.borderColor=G; }}
        onBlur={function(e)  { e.target.style.borderColor='#E5E7EB'; }}
      />

      {!search && (
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:8, marginBottom:12 }}>
          {SKILLS_DATA.map(function(cat, i) {
            return (
              <button key={cat.cat} onClick={function() { setTab(i); setExpanded(null); }}
                style={{ flexShrink:0, padding:'5px 12px', borderRadius:20, border:'1.5px solid '+(activeTab===i?G:'#E5E7EB'), background:activeTab===i?'#F0FDF7':'white', fontSize:11, fontWeight:600, cursor:'pointer', color:activeTab===i?GD:'#374151', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                {cat.icon} {cat.cat}
              </button>
            );
          })}
        </div>
      )}

      {(search ? filtered : [SKILLS_DATA[activeTab]]).map(function(cat) {
        if (!cat) return null;
        return (
          <div key={cat.cat} style={{ marginBottom:search?18:0 }}>
            {search && <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>{cat.icon} {cat.cat}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {cat.items.filter(function(it) {
                if (!search) return true;
                var q = search.toLowerCase();
                return it.name.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q);
              }).map(function(it) {
                var isOpen = expanded === (cat.cat + it.name);
                var fc = freqColor(it.freq);
                return (
                  <div key={it.name}
                    onClick={function() { setExpanded(isOpen ? null : (cat.cat + it.name)); }}
                    style={{ padding:'12px 14px', borderRadius:10, border:'1.5px solid '+(isOpen?G:'#E5E7EB'), background:isOpen?'#F0FDF7':'#F9FAFB', cursor:'pointer', transition:'all .15s' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:isOpen?8:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                        <span style={{ fontSize:13, fontWeight:800, color:isOpen?GD:DK }}>{it.name}</span>
                        <Tag bg={fc[0]} color={fc[1]}>{it.freq}</Tag>
                      </div>
                      <span style={{ fontSize:12, color:'#9CA3AF' }}>{isOpen?'v':'>'}</span>
                    </div>
                    {isOpen && (
                      <div>
                        <div style={{ fontSize:12, color:'#374151', lineHeight:1.6, marginBottom:8 }}>{it.desc}</div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          <Tag bg="#EDE9FE" color="#7C3AED">Seniority: {it.seniority}</Tag>
                          <Tag bg="#D1FAE5" color="#059669">{it.salary}</Tag>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// MODULE 4 — Boolean Search Builder
// ═══════════════════════════════════════════════════════════
var BOOL_ROLES = {
  'DevOps/SRE':    { titles:['DevOps Engineer','SRE','Site Reliability Engineer','Platform Engineer'], musts:['Kubernetes','Docker','Terraform'], nices:['Helm','ArgoCD','GitOps'] },
  'Cloud Engineer':{ titles:['Cloud Engineer','Cloud Architect','Solutions Architect'],               musts:['AWS','Azure','GCP'],              nices:['Terraform','CloudFormation','Ansible'] },
  'Java Backend':  { titles:['Java Developer','Java Engineer','Backend Developer'],                   musts:['Java','Spring Boot','Microservices'], nices:['Kafka','Redis','Docker'] },
  'Python':        { titles:['Python Developer','Python Engineer','Backend Engineer'],                musts:['Python','REST API','Microservices'],  nices:['FastAPI','Django','Flask','AWS'] },
  'Fullstack':     { titles:['Fullstack Developer','Full Stack Engineer'],                            musts:['React','Node.js','JavaScript'],        nices:['TypeScript','GraphQL','AWS'] },
  'ML/AI Engineer':{ titles:['ML Engineer','AI Engineer','Data Scientist'],                          musts:['Python','TensorFlow','PyTorch'],       nices:['Kubernetes','MLflow','AWS SageMaker'] },
  'DBA':           { titles:['Database Administrator','DBA','Database Engineer'],                     musts:['PostgreSQL','MySQL','Oracle'],          nices:['MongoDB','Redis','performance tuning'] },
  'Security':      { titles:['Security Engineer','Cybersecurity Analyst','InfoSec Engineer'],         musts:['SIEM','vulnerability management','IAM'], nices:['Splunk','CrowdStrike','CISSP'] },
};

function BooleanBuilder() {
  var [role,      setRole]      = useState('DevOps/SRE');
  var [platform,  setPlatform]  = useState('LinkedIn');
  var [musts,     setMusts]     = useState([]);
  var [nices,     setNices]     = useState([]);
  var [excludes,  setExcludes]  = useState(['junior','intern','entry level','manager']);
  var [minYrs,    setMinYrs]    = useState('5');
  var [remote,    setRemote]    = useState(false);
  var [copied,    setCopied]    = useState(false);

  useEffect(function() {
    var preset = BOOL_ROLES[role];
    if (preset) {
      setMusts(preset.musts.slice());
      setNices(preset.nices.slice());
    }
  }, [role]);

  var toggleArr = function(arr, setArr, val) {
    setArr(arr.includes(val) ? arr.filter(function(v) { return v !== val; }) : arr.concat([val]));
  };

  var buildString = function() {
    var preset = BOOL_ROLES[role];
    if (!preset) return '';
    var parts = [];
    var titleStr = '(' + preset.titles.map(function(t) { return '"' + t + '"'; }).join(' OR ') + ')';
    parts.push(titleStr);
    if (musts.length > 0) parts.push('AND (' + musts.join(' OR ') + ')');
    if (nices.length > 0) parts.push('AND (' + nices.join(' OR ') + ')');
    if (minYrs) parts.push('AND ("' + minYrs + ' years" OR "' + (parseInt(minYrs)+1) + ' years" OR "' + (parseInt(minYrs)+2) + ' years")');
    if (remote) parts.push('AND (remote OR "work from home" OR WFH)');
    if (excludes.length > 0) parts.push('NOT (' + excludes.join(' OR ') + ')');
    return parts.join('\n');
  };

  var boolStr = buildString();

  var copy = function() {
    navigator.clipboard.writeText(boolStr).then(function() {
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 2000);
    });
  };

  var preset = BOOL_ROLES[role] || { musts:[], nices:[] };

  return (
    <Card>
      <SectionTitle sub="Generate ready-to-paste search strings for LinkedIn, Indeed, or Dice">Boolean Search Builder</SectionTitle>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', marginBottom:6, textTransform:'uppercase', letterSpacing:'.5px' }}>Role Type</div>
          <select value={role} onChange={function(e) { setRole(e.target.value); }}
            style={{ width:'100%', padding:'8px 10px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:13, outline:'none', fontFamily:'inherit' }}>
            {Object.keys(BOOL_ROLES).map(function(r) { return <option key={r} value={r}>{r}</option>; })}
          </select>
        </div>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', marginBottom:6, textTransform:'uppercase', letterSpacing:'.5px' }}>Platform</div>
          <div style={{ display:'flex', gap:6 }}>
            {['LinkedIn','Indeed','Dice','GitHub'].map(function(p) {
              return (
                <button key={p} onClick={function() { setPlatform(p); }}
                  style={{ flex:1, padding:'7px 6px', borderRadius:8, border:'1.5px solid '+(platform===p?G:'#E5E7EB'), background:platform===p?'#F0FDF7':'white', fontSize:11, fontWeight:600, cursor:'pointer', color:platform===p?GD:'#374151', fontFamily:'inherit' }}>
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', marginBottom:6, textTransform:'uppercase', letterSpacing:'.5px' }}>Must-Have Skills (AND)</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {preset.musts.map(function(s) {
            var on = musts.includes(s);
            return <button key={s} onClick={function() { toggleArr(musts, setMusts, s); }}
              style={{ padding:'4px 11px', borderRadius:20, border:'1.5px solid '+(on?G:'#E5E7EB'), background:on?'#F0FDF7':'white', fontSize:11, fontWeight:600, cursor:'pointer', color:on?GD:'#6B7280', fontFamily:'inherit' }}>{s}</button>;
          })}
        </div>
      </div>

      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', marginBottom:6, textTransform:'uppercase', letterSpacing:'.5px' }}>Nice-to-Have (OR within group)</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {preset.nices.map(function(s) {
            var on = nices.includes(s);
            return <button key={s} onClick={function() { toggleArr(nices, setNices, s); }}
              style={{ padding:'4px 11px', borderRadius:20, border:'1.5px solid '+(on?'#7C3AED':'#E5E7EB'), background:on?'#EDE9FE':'white', fontSize:11, fontWeight:600, cursor:'pointer', color:on?'#7C3AED':'#6B7280', fontFamily:'inherit' }}>{s}</button>;
          })}
        </div>
      </div>

      <div style={{ display:'flex', gap:14, marginBottom:14 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', marginBottom:6, textTransform:'uppercase', letterSpacing:'.5px' }}>Min Years Exp</div>
          <select value={minYrs} onChange={function(e) { setMinYrs(e.target.value); }}
            style={{ width:'100%', padding:'8px 10px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:12, outline:'none', fontFamily:'inherit' }}>
            {['','2','3','5','7','10'].map(function(y) { return <option key={y} value={y}>{y ? y+'+ years' : 'Any'}</option>; })}
          </select>
        </div>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', marginBottom:6, textTransform:'uppercase', letterSpacing:'.5px' }}>Remote</div>
          <button onClick={function() { setRemote(!remote); }}
            style={{ padding:'8px 16px', borderRadius:9, border:'1.5px solid '+(remote?G:'#E5E7EB'), background:remote?'#F0FDF7':'white', fontSize:12, fontWeight:600, cursor:'pointer', color:remote?GD:'#374151', fontFamily:'inherit' }}>
            {remote?'Remote only':'Any location'}
          </button>
        </div>
      </div>

      <div style={{ background:'#0D1B2A', borderRadius:10, padding:'14px 16px', marginBottom:12, position:'relative' }}>
        <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginBottom:6, textTransform:'uppercase', letterSpacing:'.5px' }}>{platform} Boolean String</div>
        <pre style={{ margin:0, fontFamily:'monospace', fontSize:11, color:G, lineHeight:1.8, whiteSpace:'pre-wrap', wordBreak:'break-all' }}>{boolStr || '(Select a role to generate)'}</pre>
      </div>
      <button onClick={copy}
        style={{ width:'100%', padding:'10px', borderRadius:9, border:'none', background:copied?GD:'linear-gradient(135deg,'+G+','+GD+')', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
        {copied ? 'Copied!' : 'Copy to Clipboard'}
      </button>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// MODULE 5 — US IT Salary Benchmarks
// ═══════════════════════════════════════════════════════════
var SALARY_DATA = [
  { role:'Sr. DevOps / SRE Engineer',     c2c:'$85-120', w2:'$75-105', fte:'$140-185k', remote:true,  hot:true  },
  { role:'Cloud Architect (AWS/Azure)',    c2c:'$110-150',w2:'$95-130', fte:'$160-220k', remote:true,  hot:true  },
  { role:'Platform Engineer',             c2c:'$95-130', w2:'$85-115', fte:'$145-195k', remote:true,  hot:true  },
  { role:'Sr. Java Developer',            c2c:'$75-105', w2:'$65-90',  fte:'$120-165k', remote:false, hot:false },
  { role:'Sr. Python Developer',          c2c:'$80-110', w2:'$70-95',  fte:'$125-170k', remote:true,  hot:false },
  { role:'Fullstack Dev (React+Node)',     c2c:'$75-105', w2:'$65-90',  fte:'$115-160k', remote:true,  hot:false },
  { role:'ML / AI Engineer',              c2c:'$110-155',w2:'$95-135', fte:'$160-230k', remote:true,  hot:true  },
  { role:'Data Engineer',                 c2c:'$85-120', w2:'$75-105', fte:'$130-180k', remote:true,  hot:false },
  { role:'Cybersecurity Analyst (Sr)',     c2c:'$90-125', w2:'$80-110', fte:'$130-175k', remote:false, hot:false },
  { role:'Salesforce Developer/Admin',    c2c:'$70-100', w2:'$60-85',  fte:'$110-155k', remote:true,  hot:false },
  { role:'Scrum Master / Agile Coach',    c2c:'$65-90',  w2:'$55-75',  fte:'$100-140k', remote:true,  hot:false },
  { role:'Network Engineer (Sr)',         c2c:'$70-95',  w2:'$60-80',  fte:'$105-145k', remote:false, hot:false },
  { role:'Database Administrator (DBA)',  c2c:'$70-100', w2:'$60-85',  fte:'$110-150k', remote:false, hot:false },
  { role:'Linux / Unix Sys Admin (Sr)',   c2c:'$65-90',  w2:'$55-75',  fte:'$100-135k', remote:false, hot:false },
  { role:'Embedded / Firmware Engineer',  c2c:'$80-115', w2:'$70-100', fte:'$120-165k', remote:false, hot:false },
  { role:'iOS / Android Mobile Dev',      c2c:'$80-110', w2:'$70-95',  fte:'$120-165k', remote:true,  hot:false },
  { role:'QA Automation Engineer',        c2c:'$60-85',  w2:'$50-70',  fte:'$95-130k',  remote:true,  hot:false },
  { role:'Technical Project Manager',     c2c:'$70-100', w2:'$60-85',  fte:'$115-155k', remote:true,  hot:false },
  { role:'Blockchain / Web3 Engineer',    c2c:'$100-145',w2:'$90-125', fte:'$150-210k', remote:true,  hot:false },
  { role:'Kubernetes / K8s Specialist',   c2c:'$100-140',w2:'$90-120', fte:'$150-200k', remote:true,  hot:true  },
];

function SalaryBenchmarks() {
  var [type,      setType]    = useState('c2c');
  var [showHot,   setShowHot] = useState(false);
  var [search,    setSearch]  = useState('');

  var rows = SALARY_DATA.filter(function(r) {
    if (showHot && !r.hot) return false;
    if (search && !r.role.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Card>
      <SectionTitle sub="US market rates — Dice 2024 / Indeed / Glassdoor data">US IT Salary Benchmarks</SectionTitle>
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:0, background:'#F3F4F6', borderRadius:9, padding:3 }}>
          {[['c2c','C2C /hr'],['w2','W2 /hr'],['fte','FTE Salary']].map(function(t) {
            return <button key={t[0]} onClick={function() { setType(t[0]); }}
              style={{ padding:'5px 14px', borderRadius:7, border:'none', fontSize:11, fontWeight:600, cursor:'pointer', background:type===t[0]?'white':'transparent', color:type===t[0]?DK:'#6B7280', fontFamily:'inherit' }}>{t[1]}</button>;
          })}
        </div>
        <button onClick={function() { setShowHot(!showHot); }}
          style={{ padding:'5px 12px', borderRadius:9, border:'1.5px solid '+(showHot?'#EF4444':'#E5E7EB'), background:showHot?'#FEF2F2':'white', fontSize:11, fontWeight:600, cursor:'pointer', color:showHot?'#EF4444':'#374151', fontFamily:'inherit' }}>
          Hot Roles Only
        </button>
        <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Filter roles..."
          style={{ flex:1, minWidth:140, padding:'5px 10px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:12, outline:'none', fontFamily:'inherit' }}/>
      </div>
      <div style={{ borderRadius:10, overflow:'hidden', border:'1px solid #F0F0F0' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', background:'#F9FAFB', padding:'8px 12px', borderBottom:'1px solid #F0F0F0' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.5px' }}>Role</div>
          <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.5px', textAlign:'right', minWidth:90 }}>
            {type==='c2c'?'C2C /hr':type==='w2'?'W2 /hr':'FTE Salary'}
          </div>
          <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.5px', textAlign:'center', minWidth:70 }}>Remote</div>
        </div>
        {rows.map(function(r, i) {
          return (
            <div key={r.role} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', padding:'9px 12px', borderBottom: i < rows.length-1 ? '1px solid #F9FAFB' : 'none', background:'white' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <span style={{ fontSize:12, fontWeight:600, color:DK }}>{r.role}</span>
                {r.hot && <Tag bg="#FEE2E2" color="#DC2626">Hot</Tag>}
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:G, textAlign:'right', minWidth:90 }}>{r[type]}</div>
              <div style={{ textAlign:'center', minWidth:70, fontSize:12 }}>{r.remote ? 'Yes' : 'Hybrid'}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:10, color:'#9CA3AF', marginTop:8 }}>Rates vary by location, experience, clearance. NYC/Bay Area add 15-25%. Data: Dice 2024, Indeed, Glassdoor, LinkedIn Salary Insights.</div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// MODULE 6 — Recruiter Skill Builder
// ═══════════════════════════════════════════════════════════
var TRACKS = [
  {
    id:'tech',
    title:'Technical Literacy',
    desc:'Understand JDs, tech stacks, and screen IT candidates confidently',
    color:'#3B82F6',
    steps:[
      { id:'t1', title:'Reading a JD like an engineer', content:'Look for these sections: Required vs Preferred skills (only block on Required), Tech stack (what language + framework + infra), Seniority signals (years, words like "architect" or "lead"), and Domain (fintech, healthcare, etc.). A JD listing 20 required skills is usually written by HR — treat it as a wish list.' },
      { id:'t2', title:'Understanding tech stacks', content:'A "stack" is the combination of tools used to build a product. MEAN = MongoDB+Express+Angular+Node. MERN = React instead of Angular. LAMP = Linux+Apache+MySQL+PHP (older). When you see a JD listing all of these, the candidate needs experience in the full pipeline, not just one piece.' },
      { id:'t3', title:'Cloud tier levels', content:'Cloud Associate level certs = 2-4 years exp, building apps. Professional/Architect level = 5-8+ years, designing systems. Specialty certs (Security, ML, Networking) = deep expertise in one area. When a JD says "AWS experience required," they usually mean Associate-level knowledge minimum.' },
      { id:'t4', title:'Screening question bank by role', content:'DevOps: "What is the difference between Docker and a VM?" "Explain how you would set up a CI/CD pipeline from scratch." Java: "What is the difference between JDK and JRE?" "Explain Spring Boot auto-configuration." Python: "What is the GIL and why does it matter?" "Difference between list and generator?"' },
      { id:'t5', title:'Red flags in resumes', content:'Skills listed without context (no projects, no companies). 10+ years experience but only junior-level roles. Gaps longer than 6 months with no explanation. C2C contractor with only 1 company on resume (may be a resume mill). Certifications older than 3 years without renewals in fast-moving areas.' },
    ]
  },
  {
    id:'source',
    title:'Sourcing Mastery',
    desc:'Find hidden IT candidates on LinkedIn, GitHub, Dice, and beyond',
    color:'#7C3AED',
    steps:[
      { id:'s1', title:'LinkedIn X-Ray search (Google)', content:'Google: site:linkedin.com/in "DevOps Engineer" "AWS" "New York" -jobs. This bypasses LinkedIn limits. Add "contact" or "email" to find contactable profiles. Combine with "open to work" for active candidates. Use this when your LinkedIn Recruiter credits are exhausted.' },
      { id:'s2', title:'GitHub candidate mining', content:'Search GitHub for repos using target technologies: language:python stars:>10 pushed:>2024-01-01. Look at contributors to popular open-source projects (K8s, Terraform providers, React libraries). Their GitHub profiles often have emails and locations in the bio. These are highly qualified passive candidates.' },
      { id:'s3', title:'Dice advanced filters', content:'Use Dice\'s "C2C" filter to find contract-only candidates. Filter "Updated within 30 days" for active seekers. "Security clearance" filter is rare and valuable. Combine tech skill checkboxes rather than free-text to get cleaner results. Download profiles to CRM immediately — Dice profiles disappear.' },
      { id:'s4', title:'Stack Overflow Jobs & Dev communities', content:'Stack Overflow Careers: candidates who list themselves are actively job hunting. Reddit (r/cscareerquestions, r/devops) — post opportunities in weekly threads, never cold-message. Discord servers (Kubernetes, AWS, Python) — build relationships before recruiting. These communities will ban aggressive recruiters.' },
      { id:'s5', title:'Referral network building', content:'Every placed candidate should give you 2-3 referrals. Send a "network check-in" email every 90 days to past candidates. Connect with tech meetup organizers — they know everyone active in the local community. LinkedIn alumni filters on university pages find candidates by graduation year + major.' },
    ]
  },
  {
    id:'comm',
    title:'Client & Candidate Communication',
    desc:'Submit resumes that get interviews, prep candidates that get offers',
    color:GD,
    steps:[
      { id:'c1', title:'The perfect submission email', content:'Subject: [NAME] - [ROLE TITLE] - [KEY DIFFERENTIATOR]. Opening: 3 sentences max — who they are, what makes them unique, why they fit THIS role. Body: 5 bullet points matching JD requirements to candidate experience. Closing: availability, visa status, rate, and one clear call to action. Avoid copy-paste submissions — hiring managers notice.' },
      { id:'c2', title:'Technical phone screen prep', content:'Send candidates the JD 24 hours before. Walk through the top 5 likely questions together. Remind them: it\'s OK to say "I haven\'t used that specific tool, but I\'ve used [similar tool] and could ramp quickly." Warn them about whiteboard coding if applicable. Always do a mock 5-minute intro — most rejections happen in the first 2 minutes.' },
      { id:'c3', title:'Handling counter-offers', content:'Discuss counter-offer risk BEFORE the offer stage: "If your current company makes a counter-offer, what would it take for you to stay?" If they hesitate, they are a counter-offer risk. After a verbal offer, call the candidate BEFORE they tell their manager — if they tell the manager first, they are already in counter-offer territory.' },
      { id:'c4', title:'Client relationship management', content:'Send a 30-60-90 day check-in for every placed candidate. If a candidate is struggling, tell the client first — never let the client discover problems independently. After a placement, ask for 2 new open roles to fill. Monthly "market update" emails with salary data keep you top-of-mind for when roles open.' },
      { id:'c5', title:'Managing expectations on timelines', content:'Tech roles take 3-6 weeks from first screen to offer. Tell clients this upfront or they will pressure you. If a role has been open 90+ days, ask why — there is usually a hidden disqualifier (unrealistic salary, internal politics, unclear requirements). Do not submit more candidates into a broken hiring process.' },
    ]
  }
];

var TRACK_STORAGE = 'tf_skill_progress';
function getProgress() {
  try { return JSON.parse(localStorage.getItem(TRACK_STORAGE)) || {}; } catch (_) { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(TRACK_STORAGE, JSON.stringify(p)); } catch (_) {}
}

function SkillBuilder() {
  var [activeTrack, setTrack]    = useState('tech');
  var [expanded,    setExpanded] = useState(null);
  var [progress,    setProgress] = useState(getProgress());

  var toggle = function(stepId) {
    var next = Object.assign({}, progress);
    next[stepId] = !next[stepId];
    setProgress(next);
    saveProgress(next);
  };

  var track = TRACKS.find(function(t) { return t.id === activeTrack; });
  var done  = track ? track.steps.filter(function(s) { return progress[s.id]; }).length : 0;
  var total = track ? track.steps.length : 0;

  return (
    <Card>
      <SectionTitle sub="Structured learning paths for IT staffing recruiters">Recruiter Skill Builder</SectionTitle>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {TRACKS.map(function(t) {
          var cnt  = t.steps.filter(function(s) { return progress[s.id]; }).length;
          var isAct = activeTrack === t.id;
          return (
            <button key={t.id} onClick={function() { setTrack(t.id); setExpanded(null); }}
              style={{ flex:1, padding:'12px 10px', borderRadius:11, border:'2px solid '+(isAct?t.color:'#E5E7EB'), background:isAct?t.color+'10':'white', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
              <div style={{ fontSize:12, fontWeight:800, color:isAct?t.color:DK, marginBottom:2 }}>{t.title}</div>
              <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:6 }}>{t.desc.slice(0,45)}...</div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ flex:1, height:4, background:'#F0F0F0', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:(cnt/t.steps.length*100)+'%', background:t.color, borderRadius:99, transition:'width .3s' }}/>
                </div>
                <span style={{ fontSize:10, fontWeight:700, color:t.color }}>{cnt}/{t.steps.length}</span>
              </div>
            </button>
          );
        })}
      </div>

      {track && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:700, color:DK }}>{track.title} — {done}/{total} complete</div>
            <div style={{ height:6, width:200, background:'#F0F0F0', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:(done/total*100)+'%', background:track.color, borderRadius:99, transition:'width .3s' }}/>
            </div>
          </div>
          {track.steps.map(function(step) {
            var isOpen = expanded === step.id;
            var isDone = !!progress[step.id];
            return (
              <div key={step.id} style={{ borderRadius:10, border:'1.5px solid '+(isDone?track.color:isOpen?'#E5E7EB':'#F0F0F0'), marginBottom:8, overflow:'hidden' }}>
                <div
                  onClick={function() { setExpanded(isOpen ? null : step.id); }}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer', background:isDone?track.color+'08':isOpen?'#FAFAFA':'white' }}>
                  <div
                    onClick={function(e) { e.stopPropagation(); toggle(step.id); }}
                    style={{ width:20, height:20, borderRadius:6, flexShrink:0, border:'2px solid '+(isDone?track.color:'#D1D5DB'), background:isDone?track.color:'white', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, cursor:'pointer' }}>
                    {isDone && 'v'}
                  </div>
                  <span style={{ flex:1, fontSize:13, fontWeight:isDone?700:600, color:isDone?track.color:DK }}>{step.title}</span>
                  <span style={{ fontSize:11, color:'#9CA3AF' }}>{isOpen?'v':'>'}</span>
                </div>
                {isOpen && (
                  <div style={{ padding:'0 14px 14px', background:'white' }}>
                    <div style={{ fontSize:12, color:'#374151', lineHeight:1.7, borderTop:'1px solid #F0F0F0', paddingTop:12 }}>{step.content}</div>
                    <button onClick={function() { toggle(step.id); }}
                      style={{ marginTop:10, padding:'6px 16px', borderRadius:8, border:'none', background:isDone?'#F0F0F0':track.color, color:isDone?'#6B7280':'white', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      {isDone ? 'Mark incomplete' : 'Mark complete'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// MODULE 7 — Industry News Feed (Claude + web search, 2h cache)
// ═══════════════════════════════════════════════════════════
var STATIC_NEWS = [
  { title:'H-1B Cap Season 2025: USCIS Opens Registration Window', summary:'USCIS announced the H-1B cap registration period. Employers must file during the designated window. IT staffing firms should brief clients on premium processing timelines and lottery odds.', category:'Visa & Immigration', time:'Today', url:'https://www.uscis.gov/working-in-the-united-states/temporary-workers/h-1b-specialty-occupations' },
  { title:'Tech Hiring Remains Strong in Cloud and AI Roles — Dice Report', summary:'Dice Tech Job Report shows sustained demand for cloud architects, DevOps engineers, and AI/ML specialists. Contract rates for Kubernetes specialists up 12% YoY. Remote positions stabilized at 58% of new postings.', category:'Market Trends', time:'This week', url:'https://www.dice.com/recruiting/hiring-trends' },
  { title:'Top 10 IT Staffing Firms 2024 — Staffing Industry Analysts', summary:'SIA releases annual ranking of top US IT staffing companies. Insight Global, TEKsystems, and Robert Half lead. Boutique firms gaining market share in specialized AI/cloud niches.', category:'Industry News', time:'This week', url:'https://www2.staffingindustry.com/Research/Research-Coverage/Staffing/Largest-US-Staffing-Firms' },
  { title:'OPT STEM Extension: What IT Recruiters Need to Know in 2025', summary:'International candidates with STEM degrees can work on OPT for up to 36 months without H-1B sponsorship. IT recruiters should be fluent in EAD timelines, STEM extension requirements, and what employers actually need to do.', category:'Visa & Immigration', time:'This month', url:'https://www.uscis.gov/opt' },
  { title:'Remote Work in Tech: The 2024 State of the Market', summary:'LinkedIn data shows 45% of tech professionals prefer fully remote roles. Companies offering hybrid see 30% larger candidate pools. Recruiters who pre-screen location flexibility early reduce drop-off by 40%.', category:'Workforce Trends', time:'This month', url:'https://www.linkedin.com/pulse/topics/talent-and-recruiting/' },
];

var CAT_COLORS = {
  'Visa & Immigration': ['#DBEAFE','#1D4ED8'],
  'Market Trends':      ['#D1FAE5','#059669'],
  'Industry News':      ['#EDE9FE','#7C3AED'],
  'Workforce Trends':   ['#FEF3C7','#92400E'],
};

function NewsFeed() {
  var CACHE_KEY = 'tf_news_feed';
  var [news,    setNews]    = useState(function() { return getCached(CACHE_KEY, 2*60*60*1000); });
  var [loading, setLoading] = useState(!getCached(CACHE_KEY, 2*60*60*1000));
  var [aiFailed,setAIFailed]= useState(false);

  var load = useCallback(function() {
    var token = localStorage.getItem('tf_token');
    if (!token) { setNews(STATIC_NEWS); setLoading(false); setAIFailed(true); return; }

    fetch('/api/home/news', { headers:{ Authorization:'Bearer '+token } })
      .then(function(r) { return r.json(); })
      .then(function(r) {
        if (r.data && r.data.length > 0) {
          setCache(CACHE_KEY, r.data);
          setNews(r.data);
          setAIFailed(false);
        } else {
          setNews(STATIC_NEWS);
          setAIFailed(true);
        }
      })
      .catch(function() {
        setNews(STATIC_NEWS);
        setAIFailed(true);
      })
      .finally(function() { setLoading(false); });
  }, []);

  useEffect(function() {
    if (!news) load();
  }, []);

  var refresh = function() {
    localStorage.removeItem(CACHE_KEY);
    setNews(null);
    setLoading(true);
    load();
  };

  var displayNews = news || STATIC_NEWS;

  return (
    <Card>
      <SectionTitle
        sub={aiFailed ? 'Curated headlines — add Anthropic API key for live AI news' : 'AI-curated live headlines — refreshed every 2 hours'}
        action={
          <button onClick={refresh} disabled={loading}
            style={{ fontSize:11, color:'#9CA3AF', border:'1px solid #E5E7EB', background:'white', borderRadius:7, padding:'3px 9px', cursor:'pointer', opacity:loading?0.5:1 }}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        }>
        US IT Staffing News
      </SectionTitle>

      {loading ? <Spinner/> : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {aiFailed && (
            <div style={{ padding:'9px 12px', background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:9, fontSize:11, color:'#92400E', marginBottom:4 }}>
              Showing curated headlines. Add a valid ANTHROPIC_API_KEY in server/.env for live AI-powered news.
            </div>
          )}
          {displayNews.map(function(item, i) {
            var cc = CAT_COLORS[item.category] || ['#F3F4F6','#6B7280'];
            return (
              <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ display:'block', padding:'13px 15px', background:'#F9FAFB', borderRadius:11, border:'1px solid #F0F0F0', textDecoration:'none', transition:'all .15s' }}
                onMouseEnter={function(e) { e.currentTarget.style.borderColor=G; e.currentTarget.style.background='#F0FDF7'; }}
                onMouseLeave={function(e) { e.currentTarget.style.borderColor='#F0F0F0'; e.currentTarget.style.background='#F9FAFB'; }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                  <Tag bg={cc[0]} color={cc[1]}>{item.category}</Tag>
                  <span style={{ fontSize:10, color:'#9CA3AF' }}>{item.time}</span>
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:DK, marginBottom:4, lineHeight:1.4 }}>{item.title}</div>
                <div style={{ fontSize:11, color:'#6B7280', lineHeight:1.6 }}>{item.summary}</div>
              </a>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// MODULE 8 — JD Template Vault
// ═══════════════════════════════════════════════════════════
var JD_TEMPLATES = [
  {
    title:'Senior DevOps Engineer',
    stack:'AWS / Kubernetes / Terraform',
    body:`We are seeking a Senior DevOps Engineer to join our infrastructure team. You will design, implement, and maintain our cloud infrastructure and CI/CD pipelines.

Responsibilities:
- Design and implement infrastructure-as-code using Terraform across AWS environments
- Manage and scale Kubernetes clusters (EKS) in production
- Build and maintain CI/CD pipelines using Jenkins/GitHub Actions
- Implement monitoring and alerting with Prometheus, Grafana, and Datadog
- Lead incident response and root cause analysis for production issues
- Mentor junior engineers on DevOps best practices

Requirements:
- 5+ years of DevOps/SRE experience
- Strong hands-on experience with AWS (EC2, EKS, RDS, S3, Lambda)
- Expert-level Kubernetes administration (CKA preferred)
- Proficiency in Terraform and Ansible
- Experience with containerization (Docker, Helm)
- Strong scripting skills in Python and Bash
- Experience with GitOps workflows (ArgoCD or FluxCD)

Nice to have:
- AWS Solutions Architect certification
- Experience with service mesh (Istio, Linkerd)
- Familiarity with FinOps practices`
  },
  {
    title:'Cloud Architect (AWS/Azure)',
    stack:'Cloud / Architecture / Enterprise',
    body:`We are looking for a Cloud Architect to lead the design and migration of enterprise workloads to cloud platforms.

Responsibilities:
- Define cloud architecture strategy, standards, and governance
- Lead migration of on-premises workloads to AWS and/or Azure
- Design hybrid cloud solutions with robust security and compliance
- Evaluate emerging cloud services and recommend adoption roadmaps
- Collaborate with development teams on cloud-native application design

Requirements:
- 8+ years of IT experience with 5+ in cloud architecture
- AWS Solutions Architect Professional or Azure Solutions Architect Expert certification
- Deep expertise in networking, security, IAM, and compliance (SOC2, HIPAA, PCI)
- Experience with Infrastructure as Code (Terraform, CloudFormation, ARM Templates)
- Strong background in cost optimization and FinOps
- Excellent stakeholder communication and presentation skills`
  },
  {
    title:'Senior Java Developer',
    stack:'Java / Spring Boot / Microservices',
    body:`We are hiring a Senior Java Developer to build and maintain high-performance backend services.

Responsibilities:
- Design and develop RESTful microservices using Spring Boot
- Write efficient, testable, and maintainable Java code
- Participate in architecture decisions and code reviews
- Optimize application performance and troubleshoot production issues
- Collaborate with frontend teams on API design

Requirements:
- 5+ years of Java development experience
- Strong expertise in Spring Boot, Spring Security, and Spring Data
- Experience building microservices with Docker and Kubernetes
- Proficiency with relational databases (PostgreSQL, MySQL, Oracle)
- Experience with message queues (Kafka, RabbitMQ)
- Familiarity with CI/CD (Jenkins, GitHub Actions)
- Experience with Redis caching

Nice to have:
- AWS/Azure cloud experience
- GraphQL API development
- Experience with reactive programming (Spring WebFlux)`
  },
  {
    title:'ML / AI Engineer',
    stack:'Python / TensorFlow / AWS SageMaker',
    body:`We are seeking an ML/AI Engineer to develop and deploy machine learning models at scale.

Responsibilities:
- Design, train, and deploy ML models for production use cases
- Build and maintain ML pipelines and feature engineering workflows
- Collaborate with data scientists to productionize research models
- Monitor model performance and implement retraining pipelines
- Optimize inference performance and costs on cloud infrastructure

Requirements:
- 4+ years of ML engineering experience
- Strong Python programming skills (NumPy, Pandas, Scikit-learn)
- Experience with deep learning frameworks (TensorFlow or PyTorch)
- Hands-on experience with MLOps tools (MLflow, Kubeflow, or SageMaker)
- Strong understanding of statistics and ML fundamentals
- Experience deploying models on AWS (SageMaker, EC2, Lambda) or GCP (Vertex AI)
- Familiarity with containerization (Docker, Kubernetes)

Nice to have:
- Experience with LLMs and prompt engineering
- Knowledge of RAG architectures
- Contributions to open-source ML projects`
  },
  {
    title:'Senior Python Developer',
    stack:'Python / FastAPI / AWS',
    body:`We are looking for a Senior Python Developer to build scalable backend APIs and data pipelines.

Responsibilities:
- Design and build RESTful and GraphQL APIs using FastAPI or Django REST Framework
- Build data pipelines and ETL workflows
- Write comprehensive tests (pytest) and maintain high code quality
- Optimize database queries and application performance
- Participate in architecture design and code reviews

Requirements:
- 5+ years of Python development experience
- Expert-level Python (async/await, type hints, decorators)
- Strong experience with FastAPI, Django, or Flask
- Proficiency with PostgreSQL and ORMs (SQLAlchemy, Django ORM)
- Experience with AWS services (Lambda, S3, SQS, RDS)
- Understanding of Docker and containerization
- Experience with Redis and caching patterns`
  },
  {
    title:'Cybersecurity Engineer',
    stack:'Security / SIEM / Cloud',
    body:`We are seeking a Cybersecurity Engineer to protect our cloud and on-premises infrastructure.

Responsibilities:
- Monitor and respond to security incidents using SIEM tools (Splunk, QRadar)
- Conduct vulnerability assessments and penetration testing
- Design and implement security controls across cloud environments
- Develop and maintain security policies and procedures
- Respond to and investigate security incidents

Requirements:
- 5+ years of cybersecurity experience
- Hands-on experience with SIEM platforms (Splunk, QRadar, or Microsoft Sentinel)
- Strong knowledge of network security, firewalls, and IDS/IPS
- Experience with cloud security (AWS Security Hub, Azure Defender)
- Proficiency with vulnerability management tools (Qualys, Tenable, Rapid7)
- Security certifications preferred: CISSP, CEH, OSCP, or CompTIA Security+
- Knowledge of compliance frameworks (SOC2, PCI DSS, HIPAA, NIST)`
  },
  {
    title:'Fullstack Developer (React + Node)',
    stack:'React / Node.js / TypeScript',
    body:`We are hiring a Senior Fullstack Developer to build modern web applications end-to-end.

Responsibilities:
- Build responsive, accessible frontend UIs with React and TypeScript
- Design and implement RESTful and GraphQL backend APIs with Node.js
- Write and maintain comprehensive test suites (Jest, React Testing Library, Cypress)
- Optimize application performance and Core Web Vitals
- Collaborate closely with designers and product managers

Requirements:
- 5+ years of fullstack development experience
- Expert-level React (hooks, context, performance optimization)
- Strong TypeScript skills on both frontend and backend
- Solid Node.js and Express experience
- Experience with PostgreSQL and MongoDB
- Familiarity with AWS (S3, CloudFront, Lambda) or Azure
- Experience with Docker and basic DevOps practices

Nice to have:
- Experience with Next.js or Remix
- GraphQL API design experience
- Mobile development experience (React Native)`
  },
  {
    title:'Salesforce Developer',
    stack:'Salesforce / Apex / LWC',
    body:`We are looking for a Senior Salesforce Developer to customize and extend our Salesforce platform.

Responsibilities:
- Design and implement custom Salesforce solutions using Apex, LWC, and Visualforce
- Build complex Flows, Process Builders, and custom triggers
- Integrate Salesforce with external systems using REST/SOAP APIs
- Participate in requirements gathering and solution design
- Maintain code quality through testing and code reviews

Requirements:
- 4+ years of Salesforce development experience
- Strong Apex programming skills and SOQL proficiency
- Experience with Lightning Web Components (LWC)
- Salesforce Platform Developer I and II certifications preferred
- Experience with Salesforce integration patterns (REST API, middleware)
- Knowledge of Salesforce security model (profiles, permission sets, sharing rules)
- Experience with DevOps for Salesforce (Salesforce DX, GitHub, Copado)`
  },
  {
    title:'Scrum Master / Agile Coach',
    stack:'Agile / Scrum / Azure DevOps',
    body:`We are seeking an experienced Scrum Master to guide our development teams and champion Agile practices.

Responsibilities:
- Facilitate Scrum ceremonies (sprint planning, daily standups, retrospectives, reviews)
- Remove impediments and protect the team from external interruptions
- Coach team members and stakeholders on Agile principles
- Track and communicate team velocity, sprint goals, and progress
- Collaborate with Product Owners on backlog refinement

Requirements:
- 4+ years as a Scrum Master or Agile Coach
- CSM, PSM I, or SAFe Scrum Master certification required
- Experience with Azure DevOps, Jira, or Rally for sprint tracking
- Strong facilitation and conflict-resolution skills
- Understanding of software development lifecycle (SDLC)
- Experience scaling Agile across multiple teams (SAFe, LeSS, or Nexus)

Nice to have:
- Technical background (former developer or QA engineer)
- Experience with Kanban and hybrid Agile approaches`
  },
  {
    title:'Database Administrator (DBA)',
    stack:'PostgreSQL / Oracle / AWS RDS',
    body:`We are hiring a Senior DBA to manage and optimize our enterprise database infrastructure.

Responsibilities:
- Administer, monitor, and tune PostgreSQL, Oracle, and MySQL databases
- Design backup, recovery, and high-availability strategies
- Optimize query performance and database schemas
- Manage database migrations and upgrades
- Implement database security, access controls, and compliance requirements

Requirements:
- 6+ years of database administration experience
- Expert-level PostgreSQL administration and performance tuning
- Solid Oracle DBA experience (RAC, RMAN, Data Guard)
- Experience with AWS RDS and Aurora
- Strong knowledge of backup and recovery strategies
- Proficiency in database monitoring (pgBadger, OEM, Datadog)
- Experience with replication and high-availability setups

Nice to have:
- MongoDB or Cassandra experience
- AWS Database Specialty certification
- Experience with database-as-code (Flyway, Liquibase)`
  },
];

function JDVault() {
  var [selected, setSelected] = useState(null);
  var [copied,   setCopied]   = useState(false);
  var [search,   setSearch]   = useState('');
  var navigate = useNavigate();

  var filtered = JD_TEMPLATES.filter(function(t) {
    if (!search) return true;
    return t.title.toLowerCase().includes(search.toLowerCase()) || t.stack.toLowerCase().includes(search.toLowerCase());
  });

  var copy = function() {
    if (!selected) return;
    navigator.clipboard.writeText(selected.body).then(function() {
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 2500);
    });
  };

  return (
    <Card>
      <SectionTitle sub="10 ATS-optimized templates for the most-placed IT roles">JD Template Vault</SectionTitle>
      <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Search templates..."
        style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:12, outline:'none', boxSizing:'border-box', fontFamily:'inherit', marginBottom:12 }}
        onFocus={function(e) { e.target.style.borderColor=G; }} onBlur={function(e) { e.target.style.borderColor='#E5E7EB'; }}/>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom: selected ? 14 : 0 }}>
        {filtered.map(function(t) {
          var isActive = selected && selected.title === t.title;
          return (
            <div key={t.title} onClick={function() { setSelected(isActive ? null : t); setCopied(false); }}
              style={{ padding:'12px 14px', borderRadius:10, border:'1.5px solid '+(isActive?G:'#E5E7EB'), background:isActive?'#F0FDF7':'#F9FAFB', cursor:'pointer', transition:'all .15s' }}>
              <div style={{ fontSize:13, fontWeight:700, color:isActive?GD:DK, marginBottom:3 }}>{t.title}</div>
              <div style={{ fontSize:11, color:'#9CA3AF' }}>{t.stack}</div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div>
          <div style={{ background:'#0D1B2A', borderRadius:10, padding:'16px', marginBottom:12, maxHeight:320, overflowY:'auto' }}>
            <pre style={{ margin:0, fontFamily:'system-ui', fontSize:11, color:'rgba(255,255,255,.85)', lineHeight:1.7, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
              {selected.body}
            </pre>
          </div>
          <div style={{ display:'flex', gap:9 }}>
            <button onClick={copy}
              style={{ flex:1, padding:'10px', borderRadius:9, border:'none', background:copied?GD:'linear-gradient(135deg,'+G+','+GD+')', color:'white', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            <button
              onClick={function() { navigate('/dashboard/jobs'); }}
              style={{ padding:'10px 18px', borderRadius:9, border:'1px solid #E5E7EB', background:'white', fontSize:12, fontWeight:700, cursor:'pointer', color:'#374151', fontFamily:'inherit' }}>
              Open JD Page
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN HOME PAGE
// ═══════════════════════════════════════════════════════════

// ── Live timezone clocks ──────────────────────────────────
function Clock({ label, tz, accent }) {
  var [time, setTime] = useState('');
  useEffect(function() {
    function update() {
      setTime(new Date().toLocaleTimeString('en-US', {
        hour:'2-digit', minute:'2-digit', second:'2-digit',
        hour12:true, timeZone:tz,
      }));
    }
    update();
    var iv = setInterval(update, 1000);
    return function() { clearInterval(iv); };
  }, [tz]);
  return (
    <div style={{ textAlign:'center', padding:'8px 14px', background: accent ? 'rgba(251,191,36,.13)' : 'rgba(255,255,255,.07)', borderRadius:9, minWidth:86, border: accent ? '1px solid rgba(251,191,36,.3)' : '1px solid transparent' }}>
      <div style={{ fontSize:14, fontWeight:700, color: accent ? '#FCD34D' : 'white', letterSpacing:'.5px', fontVariantNumeric:'tabular-nums' }}>{time}</div>
      <div style={{ fontSize:10, color: accent ? 'rgba(253,224,100,.7)' : 'rgba(255,255,255,.5)', marginTop:1, fontWeight:600 }}>{label}</div>
    </div>
  );
}

// ── Recent JDs + Resumes (merged from RecruiterDashboard) ─
function RecentActivity({ jds, resumes, loading, navigate }) {
  var recentJDs     = (jds     || []).slice(0, 4);
  var recentResumes = (resumes || []).slice(0, 4);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
      {/* Recent JDs */}
      <Card style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'13px 18px', borderBottom:'1px solid #F9FAFB', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:14, fontWeight:700, color:DK }}>Recent Job Descriptions</span>
          <button onClick={function() { navigate('/dashboard/jobs'); }} style={{ fontSize:12, color:G, fontWeight:700, border:'1px solid '+G, background:'white', borderRadius:7, padding:'3px 9px', cursor:'pointer' }}>View all</button>
        </div>
        {loading
          ? <div style={{ padding:'30px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>Loading...</div>
          : recentJDs.length === 0
            ? <div style={{ padding:'30px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>No JDs yet. <button onClick={function() { navigate('/dashboard/jobs'); }} style={{ color:G, border:'none', background:'none', cursor:'pointer', fontWeight:700 }}>Add one</button></div>
            : recentJDs.map(function(jd) {
                return (
                  <div key={jd.id} onClick={function() { navigate('/dashboard/jobs'); }}
                    style={{ padding:'11px 18px', borderBottom:'1px solid #F9FAFB', cursor:'pointer', display:'flex', gap:10, alignItems:'center' }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:DK, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:800, flexShrink:0 }}>
                      {(jd.company||jd.title||'J').charAt(0)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:DK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{jd.title||'Untitled'}</div>
                      <div style={{ fontSize:11, color:'#9CA3AF' }}>{jd.company||'-'} · {new Date(jd.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
                    </div>
                    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700, background:jd.status==='applied'?'#EDE9FE':'#E6FAF2', color:jd.status==='applied'?'#7C3AED':GD, flexShrink:0 }}>
                      {jd.status}
                    </span>
                  </div>
                );
              })
        }
      </Card>

      {/* Recent Resumes */}
      <Card style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'13px 18px', borderBottom:'1px solid #F9FAFB', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:14, fontWeight:700, color:DK }}>Base Resumes</span>
          <button onClick={function() { navigate('/dashboard/resumes'); }} style={{ fontSize:12, color:G, fontWeight:700, border:'1px solid '+G, background:'white', borderRadius:7, padding:'3px 9px', cursor:'pointer' }}>Manage</button>
        </div>
        {loading
          ? <div style={{ padding:'30px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>Loading...</div>
          : recentResumes.length === 0
            ? <div style={{ padding:'30px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>No resumes yet. <button onClick={function() { navigate('/dashboard/resumes'); }} style={{ color:G, border:'none', background:'none', cursor:'pointer', fontWeight:700 }}>Upload one</button></div>
            : recentResumes.map(function(r) {
                return (
                  <div key={r.id} onClick={function() { navigate('/dashboard/resumes'); }}
                    style={{ padding:'11px 18px', borderBottom:'1px solid #F9FAFB', cursor:'pointer', display:'flex', gap:10, alignItems:'center' }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,'+G+','+GD+')', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:800, flexShrink:0 }}>
                      {(r.name||'R').charAt(0)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:DK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
                      <div style={{ fontSize:11, color:'#9CA3AF' }}>V{r.version_number} · {r.tech_stack||'General'}</div>
                    </div>
                    {r.ats_score > 0
                      ? <div style={{ textAlign:'center', flexShrink:0 }}>
                          <div style={{ fontSize:15, fontWeight:800, color:r.ats_score>=70?G:r.ats_score>=50?'#F59E0B':'#EF4444' }}>{r.ats_score}%</div>
                          <div style={{ fontSize:9, color:'#9CA3AF' }}>ATS</div>
                        </div>
                      : <button onClick={function(e) { e.stopPropagation(); navigate('/dashboard/optimizer'); }}
                          style={{ padding:'4px 10px', borderRadius:7, border:'1px solid '+G, background:'white', fontSize:11, fontWeight:700, cursor:'pointer', color:GD, flexShrink:0 }}>
                          Optimize
                        </button>
                    }
                  </div>
                );
              })
        }
        {(resumes||[]).length > 4 && (
          <div style={{ padding:'10px 18px', fontSize:11, color:'#9CA3AF', textAlign:'center' }}>+{resumes.length-4} more resumes</div>
        )}
      </Card>
    </div>
  );
}

export default function HomePage() {
  var { user }  = useAuth();
  var navigate  = useNavigate();
  var [jds,     setJds]     = useState([]);
  var [resumes, setResumes] = useState([]);
  var [points,  setPoints]  = useState([]);
  var [loading, setLoading] = useState(true);
  var [tab,     setTab]     = useState('overview');

  useEffect(function() {
    Promise.all([jdApi.getAll(), resumeApi.getBase(), pointsApi.getAll({ limit:200 })])
      .then(function(r) { setJds(r[0]||[]); setResumes(r[1]||[]); setPoints(r[2]||[]); })
      .catch(console.error)
      .finally(function() { setLoading(false); });
  }, []);

  var hour      = new Date().getHours();
  var greeting  = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  var firstName = user && user.name ? user.name.split(' ')[0] : 'there';

  var TABS = [
    { id:'overview', label:'Overview' },
    { id:'skills',   label:'IT Skills Reference' },
    { id:'boolean',  label:'Boolean Builder' },
    { id:'salary',   label:'Salary Benchmarks' },
    { id:'learning', label:'Skill Builder' },
    { id:'news',     label:'Industry News' },
    { id:'templates',label:'JD Templates' },
    { id:'interview',label:'Interview Prep' },
  ];

  return (
    <div style={{ fontFamily:'system-ui,sans-serif', minHeight:'100vh' }}>
      {/* Hero — now contains clocks */}
      <div style={{ background:'linear-gradient(135deg,#0D1B2A,#1E3A2F)', padding:'18px 28px 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:800, color:'white', marginBottom:2 }}>
              Good {greeting}, {firstName}
            </div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.55)' }}>
              Your IT staffing intelligence hub
            </div>
          </div>
          {/* Live clocks — EST, CST, PST in white, IST in amber */}
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <Clock label="EST" tz="America/New_York"/>
            <Clock label="CST" tz="America/Chicago"/>
            <Clock label="PST" tz="America/Los_Angeles"/>
            <div style={{ width:1, height:32, background:'rgba(255,255,255,.12)', margin:'0 2px' }}/>
            <Clock label="IST" tz="Asia/Kolkata" accent/>
          </div>
        </div>
        {/* Tab bar */}
        <div style={{ display:'flex', gap:4, overflowX:'auto', paddingBottom:2 }}>
          {TABS.map(function(t) {
            var isActive = tab === t.id;
            return (
              <button key={t.id} onClick={function() { setTab(t.id); }}
                style={{ flexShrink:0, padding:'6px 16px', borderRadius:20, border:'1.5px solid '+(isActive?G:'rgba(255,255,255,.15)'), background:isActive?G:'transparent', color:isActive?'white':'rgba(255,255,255,.65)', fontSize:12, fontWeight:isActive?700:500, cursor:'pointer', fontFamily:'inherit', transition:'all .15s', whiteSpace:'nowrap' }}>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding:'20px 28px', background:'#F5F7F5', minHeight:'calc(100vh - 140px)' }}>
        {/* OVERVIEW TAB — merged dashboard */}
        {tab === 'overview' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Stats row */}
            {loading ? <Spinner/> : <CommandCenter jds={jds} resumes={resumes} points={points}/>}
            {/* Recent activity: JDs + Resumes */}
            <RecentActivity jds={jds} resumes={resumes} loading={loading} navigate={navigate}/>
            {/* Market Pulse + News */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <MarketPulse/>
              <NewsFeed/>
            </div>
            {/* Quick Actions + Tips */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <Card style={{ padding:'16px 20px' }}>
                <SectionTitle>Quick Actions</SectionTitle>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
                  {[
                    { label:'Add Job Description', icon:'', to:'/dashboard/jobs',      color:G },
                    { label:'Upload Resume',        icon:'', to:'/dashboard/resumes',   color:'#3B82F6' },
                    { label:'Run Optimizer',        icon:'+', to:'/dashboard/optimizer', color:'#7C3AED' },
                    { label:'Points Library',       icon:'', to:'/dashboard/library',   color:'#F59E0B' },
                    { label:'Boolean Builder',      icon:'', tab:'boolean',             color:DK },
                    { label:'Interview Prep',       icon:'', tab:'interview',           color:'#EF4444' },
                  ].map(function(a) {
                    return (
                      <button key={a.label}
                        onClick={function() { if (a.to) navigate(a.to); else setTab(a.tab); }}
                        style={{ padding:'12px 10px', borderRadius:11, border:'1.5px solid #F0F0F0', background:'white', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:9, fontFamily:'inherit', transition:'all .15s' }}
                        onMouseEnter={function(e) { e.currentTarget.style.borderColor=a.color; e.currentTarget.style.background='#F9FAFB'; }}
                        onMouseLeave={function(e) { e.currentTarget.style.borderColor='#F0F0F0'; e.currentTarget.style.background='white'; }}>
                        <span style={{ fontSize:18 }}>{a.icon}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:DK }}>{a.label}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>
              <Card style={{ padding:'16px 20px' }}>
                <SectionTitle sub="Tips for getting the most out of TalentForge">Platform Tips</SectionTitle>
                {[
                  { tip:'Panels are resizable — drag the divider between any two panels', icon:'' },
                  { tip:'Upload & Fill in Resume Editor auto-extracts all bullets from your DOCX', icon:'' },
                  { tip:'Optimizer saves your session — going Back restores your bullet selections', icon:'' },
                  { tip:'Interview Prep questions refresh every 15 days from top US tech companies', icon:'' },
                  { tip:'Boolean Builder generates platform-specific search strings instantly', icon:'' },
                ].map(function(t, i) {
                  return (
                    <div key={i} style={{ display:'flex', gap:9, padding:'8px 0', borderBottom:i<4?'1px solid #F9FAFB':'none' }}>
                      <span style={{ fontSize:16, flexShrink:0 }}>{t.icon}</span>
                      <span style={{ fontSize:12, color:'#374151', lineHeight:1.5 }}>{t.tip}</span>
                    </div>
                  );
                })}
              </Card>
            </div>
            {/* Optimizer CTA banner */}
            <div style={{ background:'linear-gradient(135deg,#0D1B2A,#1E3A2F)', borderRadius:14, padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:'white', marginBottom:4 }}>Ready to optimize a resume?</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,.6)' }}>Select a JD and resume, AI gap analysis, ATS bullets, export DOCX</div>
              </div>
              <button onClick={function() { navigate('/dashboard/optimizer'); }}
                style={{ padding:'11px 22px', borderRadius:10, border:'none', background:G, color:'white', fontSize:14, fontWeight:700, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap', marginLeft:20 }}>
                + Run Optimizer
              </button>
            </div>
          </div>
        )}

        {tab === 'skills'    && <SkillsReference/>}
        {tab === 'boolean'   && <BooleanBuilder/>}
        {tab === 'salary'    && <SalaryBenchmarks/>}
        {tab === 'learning'  && <SkillBuilder/>}
        {tab === 'news'      && <NewsFeed/>}
        {tab === 'templates' && <JDVault/>}
        {tab === 'interview' && <InterviewPrepTab/>}
      </div>
    </div>
  );
}
