import { useState, useRef, useEffect } from 'react';
import { resumeApi } from '../../lib/api';
import useDragResize from '../../lib/useDragResize';

const G  = '#00C982';
const GD = '#009963';

var EMPTY_HEADER = { name:'', phone:'', email:'', location:'', linkedin:'', github:'' };
var EMPTY_SKILLS = {
  'Cloud Platforms':[],
  'CI/CD Tools':[],
  'Containerization':[],
  'Scripting Languages':[],
  'Databases':[],
  'Monitoring Tools':[],
};

var IT_SKILLS = [
  'AWS','Azure','GCP','OpenStack','Kubernetes','Docker','Terraform','Ansible','Jenkins',
  'GitLab CI','GitHub Actions','CircleCI','Helm','ArgoCD','FluxCD','Prometheus','Grafana',
  'Datadog','Splunk','ELK Stack','Elasticsearch','Logstash','Kibana','Nagios','PagerDuty',
  'Python','Bash','PowerShell','Go','Java','JavaScript','TypeScript','Ruby','Perl','Groovy',
  'MySQL','PostgreSQL','MongoDB','Redis','DynamoDB','Cassandra','Oracle','SQL Server',
  'Nginx','Apache','Tomcat','WebLogic','WebSphere','IIS',
  'Linux','RHEL','Ubuntu','CentOS','Windows Server','Solaris',
  'Git','Bitbucket','SVN','GitHub','GitLab',
  'Maven','Gradle','Ant','NPM','Yarn',
  'Jira','Confluence','ServiceNow','Rally',
  'Packer','Vagrant','VMware','Hyper-V','VirtualBox',
  'SonarQube','Nexus','JFrog Artifactory','QUAY',
  'AWS EC2','AWS S3','AWS Lambda','AWS ECS','AWS EKS','AWS RDS','AWS CloudFormation',
  'Azure DevOps','Azure AKS','Azure Functions','Azure SQL','Azure Storage',
  'GKE','Cloud Run','BigQuery','Pub/Sub',
  'Istio','Linkerd','Envoy','Kong',
  'Terraform Cloud','Vault','Consul','Nomad',
  'Chef','Puppet','SaltStack','CFEngine',
  'OpenShift','Rancher','Mesos','Swarm',
  'AppDynamics','New Relic','Dynatrace','CloudWatch',
  'Kafka','RabbitMQ','ActiveMQ','SQS','SNS',
  'REST APIs','GraphQL','gRPC','Microservices','Service Mesh',
  'CI/CD','DevSecOps','GitOps','SRE','Agile','Scrum','Kanban',
];

function normalizeSkills(raw) {
  if (!raw) return EMPTY_SKILLS;
  if (Array.isArray(raw)) return raw.length > 0 ? { 'Detected Skills': raw } : EMPTY_SKILLS;
  if (typeof raw === 'object') {
    var result = {};
    Object.keys(raw).forEach(function(k) {
      var v = raw[k];
      if (Array.isArray(v)) result[k] = v;
      else if (typeof v === 'string' && v) result[k] = v.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    });
    return Object.keys(result).length > 0 ? result : EMPTY_SKILLS;
  }
  return EMPTY_SKILLS;
}

function normalizeExperiences(raw) {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(function(e) {
    if (typeof e === 'string') return { company:'', role:e, dates:'', location:'', client:'', bullets:[] };
    return {
      company:  e.company  || '',
      role:     e.role     || e.title || '',
      dates:    e.dates    || '',
      location: e.location || '',
      client:   e.client   || '',
      bullets:  Array.isArray(e.bullets) ? e.bullets : [],
    };
  });
}

function calcATS(header, summary, skills, experiences, certifications, education) {
  var score = 0;
  if (header.name) score += 10;
  if (header.email && header.phone) score += 10;
  if (header.location) score += 5;
  if (header.linkedin) score += 5;
  if (summary && summary.split(' ').length >= 30) score += 15;
  else if (summary && summary.length > 0) score += 7;
  var totalSkills = Object.values(skills).reduce(function(s, a) { return s + a.length; }, 0);
  if (totalSkills >= 10) score += 15;
  else if (totalSkills >= 5) score += 8;
  var goodExps = experiences.filter(function(e) { return e.company && (e.bullets || []).length >= 3; }).length;
  if (goodExps >= 2) score += 25;
  else if (goodExps >= 1) score += 12;
  else if (experiences.length > 0) score += 5;
  if (certifications.length >= 2) score += 10;
  else if (certifications.length === 1) score += 5;
  if (education.length > 0) score += 5;
  return Math.min(100, score);
}

function healthIssues(header, summary, skills, experiences, certifications, education) {
  var issues = [];
  if (!header.name) issues.push({ level:'urgent', msg:'Full name is missing' });
  if (!header.email) issues.push({ level:'urgent', msg:'Email address is missing' });
  if (!header.phone) issues.push({ level:'urgent', msg:'Phone number is missing' });
  if (!summary || summary.split(' ').length < 30) issues.push({ level:'urgent', msg:'Professional summary is too short (aim for 30+ words)' });
  var totalSkills = Object.values(skills).reduce(function(s, a) { return s + a.length; }, 0);
  if (totalSkills < 5) issues.push({ level:'urgent', msg:'Add at least 5 technical skills' });
  if (experiences.length === 0) issues.push({ level:'urgent', msg:'No work experience added' });
  experiences.forEach(function(e, i) {
    if (!e.company) issues.push({ level:'urgent', msg: 'Role ' + (i+1) + ': Company name missing' });
    if ((e.bullets || []).length < 3) issues.push({ level:'improve', msg: (e.company||'Role '+(i+1)) + ': Add at least 3 bullet points' });
    if ((e.bullets || []).length >= 3 && (e.bullets || []).some(function(b) { return b.length < 30; })) {
      issues.push({ level:'optional', msg: (e.company||'Role '+(i+1)) + ': Some bullets are too short - expand them' });
    }
  });
  if (!header.location) issues.push({ level:'improve', msg:'Add your city/state location' });
  if (!header.linkedin) issues.push({ level:'improve', msg:'Add your LinkedIn URL' });
  if (certifications.length === 0) issues.push({ level:'optional', msg:'Add any relevant certifications' });
  if (education.length === 0) issues.push({ level:'optional', msg:'Add your education' });
  return issues;
}

function SkillChip({ skill, onRemove }) {
  var [hover, setHover] = useState(false);
  return (
    <span
      style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 12px 4px 10px', borderRadius:20, background:hover?'#D1FAE5':'#E6FAF2', border:'1.5px solid ' + (hover?GD:'#A7F3D0'), fontSize:12, color:GD, fontWeight:600, margin:'3px', cursor:'default', transition:'all .15s' }}
      onMouseEnter={function() { setHover(true); }}
      onMouseLeave={function() { setHover(false); }}>
      {skill}
      <button
        onClick={function() { onRemove(skill); }}
        style={{ border:'none', background:hover?'#EF4444':'transparent', color:hover?'white':'#9CA3AF', fontSize:11, padding:'0 1px', lineHeight:1, borderRadius:'50%', cursor:'pointer', width:14, height:14, display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s' }}>
        x
      </button>
    </span>
  );
}

function SkillGroup({ label, skills, onChange, onDeleteGroup }) {
  var [input,    setInput]    = useState('');
  var [focused,  setFocused]  = useState(false);
  var [suggests, setSuggests] = useState([]);

  function handleInput(val) {
    setInput(val);
    if (val.length < 1) { setSuggests([]); return; }
    var lv = val.toLowerCase();
    var matches = IT_SKILLS.filter(function(s) {
      return s.toLowerCase().startsWith(lv) && skills.indexOf(s) < 0;
    }).slice(0, 6);
    setSuggests(matches);
  }

  function addSkill(s) {
    var t = (s || input).trim();
    if (!t || skills.indexOf(t) >= 0) { setInput(''); setSuggests([]); return; }
    onChange(skills.concat([t]));
    setInput(''); setSuggests([]);
  }

  function removeSkill(s) { onChange(skills.filter(function(x) { return x !== s; })); }

  return (
    <div style={{ marginBottom:16, paddingBottom:16, borderBottom:'1px solid #F3F4F6' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>{label}</span>
        {onDeleteGroup && (
          <button onClick={onDeleteGroup} style={{ marginLeft:'auto', fontSize:12, color:'#9CA3AF', border:'none', background:'none', cursor:'pointer', padding:'2px 6px', borderRadius:5 }}>X</button>
        )}
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center' }}>
        {skills.map(function(s) { return <SkillChip key={s} skill={s} onRemove={removeSkill}/>; })}
        <div style={{ position:'relative', margin:'3px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:0, border:'1.5px solid ' + (focused?G:'#D1D5DB'), borderRadius:20, overflow:'hidden', background:'white', transition:'border-color .15s' }}>
            <input
              value={input}
              onChange={function(e) { handleInput(e.target.value); }}
              onKeyDown={function(e) {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(); }
                if (e.key === 'Escape') { setInput(''); setSuggests([]); }
              }}
              onFocus={function() { setFocused(true); }}
              onBlur={function() { setTimeout(function() { setFocused(false); setSuggests([]); }, 150); }}
              placeholder="Add skill..."
              style={{ border:'none', outline:'none', padding:'4px 10px', fontSize:12, color:'#374151', background:'transparent', minWidth:100 }}
            />
            {input && (
              <button
                onClick={function() { addSkill(); }}
                style={{ padding:'4px 10px', border:'none', background:G, color:'white', fontSize:12, fontWeight:700, cursor:'pointer', borderRadius:0 }}>
                +
              </button>
            )}
          </div>
          {suggests.length > 0 && (
            <div style={{ position:'absolute', top:'100%', left:0, background:'white', border:'1px solid #E5E7EB', borderRadius:8, boxShadow:'0 4px 12px rgba(0,0,0,.1)', zIndex:50, minWidth:160, marginTop:2 }}>
              {suggests.map(function(s) {
                return (
                  <div key={s} onMouseDown={function() { addSkill(s); }}
                    style={{ padding:'7px 12px', fontSize:12, color:'#374151', cursor:'pointer', borderBottom:'1px solid #F9FAFB' }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = '#F0FDF7'; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = 'white'; }}>
                    {s}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BulletEditor({ bullets, onChange }) {
  function add()          { onChange((bullets||[]).concat([''])); }
  function update(i, v)   { var a = (bullets||[]).slice(); a[i] = v; onChange(a); }
  function remove(i)      { onChange((bullets||[]).filter(function(_, idx) { return idx !== i; })); }

  function handlePaste(e) {
    var text = e.clipboardData.getData('text');
    var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    var isBulletList = lines.length > 1 && lines.some(function(l) { return /^[-\-\*\d+\.]\s/.test(l); });
    if (isBulletList) {
      e.preventDefault();
      var cleaned = lines.map(function(l) { return l.replace(/^[-\-\*\d+\.]\s+/, '').trim(); }).filter(Boolean);
      onChange((bullets||[]).concat(cleaned));
    }
  }

  return (
    <div>
      {(bullets||[]).map(function(b, i) {
        return (
          <div key={i} style={{ display:'flex', gap:8, marginBottom:6, alignItems:'flex-start' }}>
            <span style={{ color:'#9CA3AF', marginTop:10, fontSize:14, flexShrink:0 }}>-</span>
            <textarea
              value={b}
              onChange={function(e) { update(i, e.target.value); }}
              onPaste={handlePaste}
              rows={2}
              placeholder="Start with an action verb (e.g. Designed, Built, Led, Automated...)"
              style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:12, resize:'vertical', outline:'none', color:'#374151', lineHeight:1.5, fontFamily:'inherit', transition:'border-color .15s' }}
              onFocus={function(e) { e.target.style.borderColor = G; }}
              onBlur={function(e) { e.target.style.borderColor = '#E5E7EB'; }}
            />
            <button onClick={function() { remove(i); }} style={{ marginTop:8, border:'none', background:'none', cursor:'pointer', color:'#9CA3AF', fontSize:16, padding:'2px 4px', borderRadius:4, transition:'color .15s' }}
              onMouseEnter={function(e) { e.currentTarget.style.color = '#EF4444'; }}
              onMouseLeave={function(e) { e.currentTarget.style.color = '#9CA3AF'; }}>x</button>
          </div>
        );
      })}
      <button onClick={add}
        style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:8, border:'1.5px dashed ' + G, background:'#F0FDF7', fontSize:12, cursor:'pointer', color:GD, fontWeight:600, fontFamily:'inherit', transition:'all .15s', marginTop:4 }}
        onMouseEnter={function(e) { e.currentTarget.style.background = '#D1FAE5'; }}
        onMouseLeave={function(e) { e.currentTarget.style.background = '#F0FDF7'; }}>
        <span style={{ fontSize:16, lineHeight:1 }}>+</span> Add Bullet Point
      </button>
    </div>
  );
}

// -- TEMPLATE PREVIEWS --------------------------------------

function ClassicPreview({ header, summary, skills, experiences, certifications, education }) {
  var flatSkills = {};
  Object.entries(skills).forEach(function(e) { if (e[1].length > 0) flatSkills[e[0]] = e[1]; });
  return (
    <div style={{ fontFamily:'Times New Roman, serif', fontSize:11, lineHeight:1.6, color:'#111', padding:'28px 32px', background:'white', minHeight:400 }}>
      <div style={{ textAlign:'center', marginBottom:12 }}>
        <div style={{ fontSize:18, fontWeight:700, letterSpacing:'.5px' }}>{header.name || 'Your Name'}</div>
        <div style={{ fontSize:10, marginTop:3 }}>
          {[header.phone, header.email, header.location].filter(Boolean).join('  |  ')}
        </div>
        {(header.linkedin||header.github) && (
          <div style={{ fontSize:10, color:'#555' }}>{[header.linkedin,header.github].filter(Boolean).join('  |  ')}</div>
        )}
      </div>
      {summary && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', borderBottom:'1.5px solid #111', paddingBottom:2, marginBottom:5 }}>Professional Summary</div>
          <div style={{ fontSize:10, lineHeight:1.7 }}>{summary.slice(0,300)}{summary.length>300?'...':''}</div>
        </div>
      )}
      {Object.keys(flatSkills).length > 0 && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', borderBottom:'1.5px solid #111', paddingBottom:2, marginBottom:5 }}>Technical Skills</div>
          {Object.entries(flatSkills).slice(0,5).map(function(e) {
            return <div key={e[0]} style={{ fontSize:10, marginBottom:2 }}><strong>{e[0]}:</strong> {e[1].join(', ')}</div>;
          })}
        </div>
      )}
      {experiences.length > 0 && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', borderBottom:'1.5px solid #111', paddingBottom:2, marginBottom:5 }}>Professional Experience</div>
          {experiences.slice(0,2).map(function(exp, i) {
            return (
              <div key={i} style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <div><strong>{exp.company||'Company'}</strong> | <em>{exp.role||'Title'}</em></div>
                  <div style={{ fontSize:10 }}>{exp.dates}</div>
                </div>
                {(exp.bullets||[]).slice(0,2).map(function(b,j) { return <div key={j} style={{ paddingLeft:12, fontSize:10 }}>- {b}</div>; })}
              </div>
            );
          })}
        </div>
      )}
      {certifications.length > 0 && (
        <div style={{ marginBottom:8 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', borderBottom:'1.5px solid #111', paddingBottom:2, marginBottom:4 }}>Certifications</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1px 12px' }}>
            {certifications.slice(0,4).map(function(c,i) { return <div key={i} style={{ fontSize:10 }}>- {c.name}</div>; })}
          </div>
        </div>
      )}
      {education.length > 0 && (
        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', borderBottom:'1.5px solid #111', paddingBottom:2, marginBottom:4 }}>Education</div>
          {education.slice(0,2).map(function(e,i) {
            return (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                <div><strong>{e.school}</strong>{e.degree?' | '+e.degree:''}</div>
                <div>{[e.start,e.end].filter(Boolean).join(' - ')}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExecutivePreview({ header, summary, skills, experiences, certifications, education }) {
  var flatSkills = {};
  Object.entries(skills).forEach(function(e) { if (e[1].length > 0) flatSkills[e[0]] = e[1]; });
  return (
    <div style={{ fontFamily:'Segoe UI, system-ui, sans-serif', fontSize:10.5, lineHeight:1.4, color:'#1a1a1a', padding:'20px 28px', background:'white', minHeight:400 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', borderBottom:'2px solid #0D1B2A', paddingBottom:8, marginBottom:10 }}>
        <div>
          <span style={{ fontSize:17, fontWeight:800, letterSpacing:'-.3px' }}>{header.name||'Your Name'}</span>
        </div>
        <div style={{ fontSize:9, color:'#555', textAlign:'right' }}>
          {[header.email,header.phone,header.location].filter(Boolean).join(' . ')}
        </div>
      </div>
      {summary && (
        <div style={{ marginBottom:9 }}>
          <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'#0D1B2A', marginBottom:3 }}>Summary</div>
          <div style={{ fontSize:10, lineHeight:1.6, color:'#333' }}>{summary.slice(0,250)}{summary.length>250?'...':''}</div>
        </div>
      )}
      {Object.keys(flatSkills).length > 0 && (
        <div style={{ marginBottom:9 }}>
          <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'#0D1B2A', marginBottom:3 }}>Technical Skills</div>
          {Object.entries(flatSkills).slice(0,5).map(function(e) {
            return <div key={e[0]} style={{ fontSize:9.5, marginBottom:1.5 }}><strong style={{ color:'#0D1B2A' }}>{e[0]}:</strong> {e[1].join(' . ')}</div>;
          })}
        </div>
      )}
      {experiences.length > 0 && (
        <div style={{ marginBottom:9 }}>
          <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'#0D1B2A', marginBottom:4 }}>Experience</div>
          {experiences.slice(0,2).map(function(exp, i) {
            return (
              <div key={i} style={{ marginBottom:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                  <div style={{ fontWeight:700, fontSize:10 }}>{exp.company||'Company'} <span style={{ fontWeight:400, fontStyle:'italic' }}>- {exp.role||'Title'}</span></div>
                  <div style={{ fontSize:9, color:'#666' }}>{exp.dates}</div>
                </div>
                {(exp.bullets||[]).slice(0,2).map(function(b,j) { return <div key={j} style={{ paddingLeft:10, fontSize:9.5, lineHeight:1.5 }}>- {b}</div>; })}
              </div>
            );
          })}
        </div>
      )}
      {certifications.length > 0 && (
        <div style={{ marginBottom:8 }}>
          <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'#0D1B2A', marginBottom:3 }}>Certifications</div>
          <div style={{ fontSize:9.5 }}>{certifications.map(function(c) { return c.name; }).join('  .  ')}</div>
        </div>
      )}
      {education.length > 0 && (
        <div>
          <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'#0D1B2A', marginBottom:3 }}>Education</div>
          {education.slice(0,2).map(function(e,i) {
            return (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:9.5 }}>
                <div><strong>{e.school}</strong>{e.degree?' . '+e.degree:''}</div>
                <div style={{ color:'#666' }}>{[e.start,e.end].filter(Boolean).join(' - ')}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -- MAIN EDITOR --------------------------------------------

// Reshape old flat content { name, email, phone, ... } into the
// { header, summary, skills, experiences, education, certifications }
// shape that all editor state reads. Safe to call on already-shaped content.
function reshapeContent(raw) {
  if (!raw || typeof raw !== 'object') return {};
  // Already shaped correctly if it has a 'header' key with name/email
  if (raw.header && (raw.header.name !== undefined || raw.header.email !== undefined)) {
    return raw;
  }
  // Old flat shape: { name, email, phone, location, linkedin, github, summary, skills:[], experiences:[], ... }
  var skills = raw.skills || {};
  if (Array.isArray(skills)) {
    skills = skills.length > 0 ? { 'Detected Skills': skills } : {};
  }
  var education = raw.education || [];
  if (typeof education === 'string') {
    education = education ? [{ school: education, degree:'', start:'', end:'', gpa:'', location:'' }] : [];
  }
  if (!Array.isArray(education)) education = [];
  return {
    header: {
      name:     raw.name     || '',
      email:    raw.email    || '',
      phone:    raw.phone    || '',
      location: raw.location || '',
      linkedin: raw.linkedin || '',
      github:   raw.github   || '',
    },
    summary:        raw.summary        || '',
    skills,
    experiences:    Array.isArray(raw.experiences)    ? raw.experiences    : [],
    education,
    certifications: Array.isArray(raw.certifications) ? raw.certifications : [],
  };
}

export default function ResumeEditor({ resume, onBack, onSave, onDelete }) {
  var isNew = !resume;
  // Reshape handles both old flat shape and new header-wrapped shape
  var rawContent = reshapeContent(resume && resume.content ? resume.content : {});

  var [name,           setName]           = useState(resume ? (resume.name||'') : '');
  var [techStack,      setTechStack]      = useState(resume ? (resume.tech_stack||'') : '');
  var [yearsExp,       setYearsExp]       = useState(resume ? (resume.years_experience||'') : '');
  var [template,       setTemplate]       = useState(resume ? (resume.template_name||'classic') : 'classic');
  var [header,         setHeader]         = useState(rawContent.header || EMPTY_HEADER);
  var [summary,        setSummary]        = useState(rawContent.summary || (resume ? (resume.summary_text||'') : ''));
  var [skills,         setSkills]         = useState(normalizeSkills(rawContent.skills));
  var [experiences,    setExperiences]    = useState(normalizeExperiences(rawContent.experiences));
  var [education,      setEducation]      = useState(Array.isArray(rawContent.education) ? rawContent.education : []);
  var [certifications, setCertifications] = useState(Array.isArray(rawContent.certifications) ? rawContent.certifications : []);
  var [saving,         setSaving]         = useState(false);
  var [genSummary,     setGenSummary]     = useState(false);
  var [newGroup,       setNewGroup]       = useState('');
  var [addingGroup,    setAddingGroup]    = useState(false);
  var [rightTab,       setRightTab]       = useState('preview'); // 'preview' | 'style' | 'health'
  var [autoFilling,    setAutoFilling]    = useState(false);
  var [autoFillMsg,    setAutoFillMsg]    = useState('');
  var [autoFillDone,   setAutoFillDone]   = useState(false);
  var [autoFillPartial, setAutoFillPartial] = useState(false); // true when claudeFailed
  var autoFillRef = useRef(null);

  var atsScore   = calcATS(header, summary, skills, experiences, certifications, education);
  var issues     = healthIssues(header, summary, skills, experiences, certifications, education);
  var urgentCnt  = issues.filter(function(i) { return i.level === 'urgent'; }).length;
  var improveCnt = issues.filter(function(i) { return i.level === 'improve'; }).length;
  var optionalCnt= issues.filter(function(i) { return i.level === 'optional'; }).length;

  var atsColor = atsScore >= 70 ? G : atsScore >= 45 ? '#F59E0B' : '#EF4444';
  var atsLabel = atsScore >= 70 ? 'STRONG' : atsScore >= 45 ? 'IMPROVABLE' : 'NEEDS WORK';

  function updateHeader(key, val) {
    setHeader(function(h) { var n = Object.assign({}, h); n[key] = val; return n; });
  }

  async function handleGenerateSummary() {
    var flatSkills = Object.values(skills).reduce(function(a,b) { return a.concat(b); }, []).slice(0,10);
    if (!header.name && flatSkills.length === 0 && experiences.length === 0) {
      alert('Fill in your name, skills, or experience first so Claude can write a relevant summary.');
      return;
    }
    setGenSummary(true);
    try {
      var prompt = 'Write a professional IT resume summary (2-3 sentences, 40-60 words). ' +
        'Name: ' + (header.name||'IT Professional') + '. ' +
        'Years exp: ' + (yearsExp||'several') + '. ' +
        'Top skills: ' + flatSkills.join(', ') + '. ' +
        'Roles: ' + experiences.slice(0,2).map(function(e) { return e.role; }).filter(Boolean).join(', ') + '. ' +
        'Write in first person implied (no "I"), professional tone. No cliches like "passionate" or "results-driven". Sound like a real senior engineer wrote it.';

      var res = await fetch('/api/resume/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + localStorage.getItem('tf_token') },
        body: JSON.stringify({ prompt: prompt }),
      });
      var data = await res.json();
      if (data.summary) setSummary(data.summary);
      else alert('Could not generate summary. Try again.');
    } catch(e) { alert(e.message); }
    finally { setGenSummary(false); }
  }

  function handleAutoFill(file) {
    if (!file) return;
    var ext = file.name.split('.').pop().toLowerCase();
    if (!['docx','pdf','txt'].includes(ext)) { alert('Only .docx, .pdf, .txt supported'); return; }
    setAutoFilling(true);
    setAutoFillMsg('Reading ' + file.name + '...');
    setAutoFillDone(false);
    setAutoFillPartial(false);
    var fd = new FormData();
    fd.append('file', file);
    resumeApi.parse(fd)
      .then(function(res) {
        setAutoFillMsg('Filling in your resume...');
        var p = res.data || {};
        var partial = !!(res.claudeFailed);

        // Fill Personal Info
        if (p.name || p.email || p.phone || p.location) {
          setHeader(function(h) {
            return {
              name:     p.name     || h.name,
              email:    p.email    || h.email,
              phone:    p.phone    || h.phone,
              location: p.location || h.location,
              linkedin: p.linkedin || h.linkedin || '',
              github:   p.github   || h.github   || '',
            };
          });
        }
        // Fill Summary
        if (p.summary && p.summary.trim()) setSummary(p.summary.trim());
        // Fill Skills
        if (p.skills) {
          var normalized;
          if (Array.isArray(p.skills) && p.skills.length > 0) {
            normalized = { 'Detected Skills': p.skills };
          } else if (typeof p.skills === 'object' && !Array.isArray(p.skills)) {
            normalized = {};
            Object.keys(p.skills).forEach(function(k) {
              var v = p.skills[k];
              if (Array.isArray(v) && v.length > 0) normalized[k] = v;
              else if (typeof v === 'string' && v) normalized[k] = v.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
            });
          }
          if (normalized && Object.keys(normalized).length > 0) setSkills(normalized);
        }
        // Fill Experiences with full bullet points
        if (p.experiences && p.experiences.length > 0) {
          var exps = p.experiences.map(function(e) {
            return {
              company:  e.company  || '',
              role:     e.role     || e.title || '',
              dates:    e.dates    || '',
              location: e.location || '',
              client:   e.client   || '',
              bullets:  Array.isArray(e.bullets) ? e.bullets.filter(function(b) { return b && b.trim(); }) : [],
            };
          });
          setExperiences(exps);
        }
        // Fill Certifications
        if (p.certifications && p.certifications.length > 0) {
          var certs = p.certifications.map(function(c) {
            if (typeof c === 'string') return { name: c, date: '' };
            return { name: c.name || '', date: c.date || '' };
          });
          setCertifications(certs);
        }
        // Fill Education
        if (p.education) {
          var edu = Array.isArray(p.education) ? p.education : [];
          if (edu.length > 0) {
            setEducation(edu.map(function(e) {
              return {
                school:   e.school   || e.university || '',
                degree:   e.degree   || '',
                start:    e.start    || e.startYear  || '',
                end:      e.end      || e.endYear    || '',
                gpa:      e.gpa      || '',
                location: e.location || '',
              };
            }));
          }
        }
        // Pre-fill resume name from filename if not already set
        if (!name) {
          setName(file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
        }
        setAutoFillMsg('');
        setAutoFillDone(true);
        setAutoFillPartial(partial);
        setTimeout(function() { setAutoFillDone(false); setAutoFillPartial(false); }, 6000);
      })
      .catch(function(e) {
        setAutoFillMsg('');
        console.error('Auto-fill error:', e);
        alert('Could not parse file: ' + e.message + '. Check that the server is running.');
      })
      .finally(function() { setAutoFilling(false); });
  }

  function handleSave() {
    if (!name.trim()) { alert('Give this resume a name'); return; }
    setSaving(true);
    // content is always stored in the proper { header, summary, skills, experiences,
    // education, certifications } shape so ResumeEditor can re-read it correctly.
    var content = {
      header: header,
      summary: summary,
      skills: skills,
      experiences: experiences,
      education: education,
      certifications: certifications,
    };
    var promise;
    if (isNew) {
      promise = resumeApi.saveBase({
        name: name,
        tech_stack: techStack || null,
        years_experience: yearsExp || null,
        template_name: template,
        content: content,
        summary_text: summary,
        parsed: {
          name: header.name, title: '', email: header.email,
          phone: header.phone, location: header.location,
          summary: summary, years: yearsExp || 0,
          experiences: experiences, certifications: certifications,
          education: education,
        },
        rawText: '',
        detectedFormat: 'E',
      });
    } else {
      promise = resumeApi.updateBase(resume.id, {
        name: name,
        tech_stack: techStack || null,
        years_experience: yearsExp || null,
        content: content,
        summary_text: summary,
        template_name: template,
      }).catch(function() {
        // Optimistic fallback: return merged object so UI stays responsive
        return Object.assign({}, resume, { content: content, name: name, summary_text: summary, template_name: template });
      });
    }
    promise.then(function(saved) { onSave(saved); }).catch(function(e) { alert(e.message); }).finally(function() { setSaving(false); });
  }

  function addSkillGroup() {
    var n = newGroup.trim();
    if (!n || skills[n]) return;
    setSkills(function(s) { var ns = Object.assign({}, s); ns[n] = []; return ns; });
    setNewGroup(''); setAddingGroup(false);
  }

  function addExp()       { setExperiences(function(e) { return e.concat([{company:'',role:'',dates:'',location:'',client:'',bullets:[]}]); }); }
  function updExp(i,k,v)  { setExperiences(function(e) { return e.map(function(x,idx) { if(idx!==i)return x; var n=Object.assign({},x); n[k]=v; return n; }); }); }
  function delExp(i)      { setExperiences(function(e) { return e.filter(function(_,idx) { return idx!==i; }); }); }
  function moveExp(i, dir){ setExperiences(function(e) { var a=e.slice(); var t=a[i]; a[i]=a[i+dir]; a[i+dir]=t; return a; }); }

  function addEdu()       { setEducation(function(e) { return e.concat([{school:'',degree:'',start:'',end:'',gpa:'',location:''}]); }); }
  function updEdu(i,k,v)  { setEducation(function(e) { return e.map(function(x,idx) { if(idx!==i)return x; var n=Object.assign({},x); n[k]=v; return n; }); }); }
  function delEdu(i)      { setEducation(function(e) { return e.filter(function(_,idx) { return idx!==i; }); }); }

  function addCert()      { setCertifications(function(c) { return c.concat([{name:'',date:''}]); }); }
  function updCert(i,k,v) { setCertifications(function(c) { return c.map(function(x,idx) { if(idx!==i)return x; var n=Object.assign({},x); n[k]=v; return n; }); }); }
  function delCert(i)     { setCertifications(function(c) { return c.filter(function(_,idx) { return idx!==i; }); }); }

  var inp = { width:'100%', padding:'9px 11px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:13, outline:'none', color:'#374151', boxSizing:'border-box', fontFamily:'inherit', transition:'border-color .15s' };
  var lbl = { display:'block', fontSize:11, fontWeight:700, color:'#6B7280', marginBottom:5, textTransform:'uppercase', letterSpacing:'.5px' };
  var sec = { background:'white', borderRadius:14, border:'1px solid #F0F0F0', padding:'20px 22px', marginBottom:14, boxShadow:'0 1px 3px rgba(0,0,0,.04)' };

  var dragPreview = useDragResize({ initial:390, min:260, max:680, side:'right', storageKey:'tf_editor_preview' });

  return (
    <div style={{ display:'flex', width:'100%', height:'100%', overflow:'hidden', fontFamily:'system-ui,sans-serif', background:'#F5F7F5' }}>

      {/* -- LEFT: Editor -- */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 22px', minWidth:0 }}>

        {/* Top bar */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
          <button onClick={onBack} style={{ padding:'8px 13px', borderRadius:9, border:'1px solid #E5E7EB', background:'white', fontSize:12, fontWeight:600, cursor:'pointer', color:'#374151', fontFamily:'inherit', flexShrink:0 }}>Back</button>
          <input value={name} onChange={function(e){setName(e.target.value);}} placeholder="Resume name (e.g. Sr DevOps Engineer - AWS)"
            style={{ flex:1, padding:'9px 13px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:14, fontWeight:700, outline:'none', color:'#0D1B2A', fontFamily:'inherit', transition:'border-color .15s' }}
            onFocus={function(e){e.target.style.borderColor=G;}} onBlur={function(e){e.target.style.borderColor='#E5E7EB';}}/>
          <select value={techStack} onChange={function(e){setTechStack(e.target.value);}}
            style={{ padding:'9px 11px', borderRadius:9, border:'1px solid #E5E7EB', fontSize:12, color:'#374151', background:'white', cursor:'pointer', fontFamily:'inherit' }}>
            <option value="">Tech stack</option>
            {['DevOps','Cloud','Java','Security','AI/ML','Full Stack','Data Engineering','Networking','SRE'].map(function(t){return <option key={t}>{t}</option>;})}
          </select>
          <input value={yearsExp} onChange={function(e){setYearsExp(e.target.value);}} placeholder="Yrs" type="number"
            style={{ width:72, padding:'9px 10px', borderRadius:9, border:'1px solid #E5E7EB', fontSize:12, outline:'none', color:'#374151', fontFamily:'inherit' }}/>
          <button onClick={handleSave} disabled={saving}
            style={{ padding:'9px 20px', borderRadius:9, border:'none', background:saving?'#E5E7EB':'linear-gradient(135deg,#00C982,#009963)', color:saving?'#9CA3AF':'white', fontSize:13, fontWeight:700, cursor:saving?'not-allowed':'pointer', fontFamily:'inherit', flexShrink:0, boxShadow:saving?'none':'0 4px 12px rgba(0,201,130,.3)' }}>
            {saving?'Saving...':'Save Resume'}
          </button>
        </div>

        {/* Upload to Auto-Fill banner */}
        <div style={{ background:'white', borderRadius:13, border:'2px dashed ' + (autoFillDone ? (autoFillPartial ? '#F59E0B' : G) : '#D1D5DB'), padding:'16px 20px', marginBottom:14, boxShadow:'0 1px 3px rgba(0,0,0,.04)', transition:'border-color .3s' }}>
          <input ref={autoFillRef} type="file" accept=".docx,.pdf,.txt" style={{ display:'none' }}
            onChange={function(e) { if (e.target.files[0]) { handleAutoFill(e.target.files[0]); e.target.value=''; } }}/>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:autoFillDone?(autoFillPartial?'#FEF3C7':'#D1FAE5'):autoFilling?'#F3F4F6':'#F0FDF7', border:'1.5px solid '+(autoFillDone?(autoFillPartial?'#F59E0B':G):autoFilling?'#E5E7EB':G+'66'), display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, flexShrink:0, transition:'all .3s', color:autoFillPartial?'#92400E':GD }}>
              {autoFillDone ? (autoFillPartial ? '~' : 'OK') : autoFilling ? '...' : ''}
            </div>
            <div style={{ flex:1 }}>
              {autoFillDone && !autoFillPartial ? (
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:GD, marginBottom:2 }}>Resume auto-filled successfully!</div>
                  <div style={{ fontSize:12, color:'#6B7280' }}>All sections populated - review and edit anything below, then save.</div>
                </div>
              ) : autoFillDone && autoFillPartial ? (
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#92400E', marginBottom:2 }}>Partial fill complete - AI parsing unavailable</div>
                  <div style={{ fontSize:12, color:'#6B7280' }}>Contact info and experience titles were detected. Bullet points, skills, and summary need manual entry. Add your ANTHROPIC_API_KEY to server/.env for full AI parse.</div>
                </div>
              ) : autoFilling ? (
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#374151', marginBottom:2 }}>{autoFillMsg}</div>
                  <div style={{ fontSize:12, color:'#9CA3AF' }}>Extracting all content including bullet points...</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#0D1B2A', marginBottom:2 }}>Upload to Auto-Fill</div>
                  <div style={{ fontSize:12, color:'#6B7280' }}>Upload a DOCX, PDF, or TXT - all sections including bullet points will be extracted and pre-filled below for you to edit.</div>
                </div>
              )}
            </div>
            {!autoFilling && !autoFillDone && (
              <button
                onClick={function() { autoFillRef.current && autoFillRef.current.click(); }}
                style={{ padding:'9px 20px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00C982,#009963)', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(0,201,130,.3)', flexShrink:0, fontFamily:'inherit', whiteSpace:'nowrap' }}>
                Upload & Fill
              </button>
            )}
            {autoFilling && (
              <div style={{ padding:'9px 20px', borderRadius:10, border:'1px solid #E5E7EB', background:'#F9FAFB', fontSize:13, color:'#9CA3AF', flexShrink:0 }}>Parsing...</div>
            )}
            {autoFillDone && (
              <button
                onClick={function() { autoFillRef.current && autoFillRef.current.click(); }}
                style={{ padding:'9px 16px', borderRadius:10, border:'1px solid #E5E7EB', background:'white', fontSize:12, fontWeight:600, cursor:'pointer', color:'#374151', flexShrink:0, fontFamily:'inherit' }}>
                Re-upload
              </button>
            )}
          </div>
        </div>

        {/* ATS Score bar */}
        <div style={{ background:'white', borderRadius:12, padding:'12px 18px', border:'1px solid #F0F0F0', marginBottom:14, display:'flex', alignItems:'center', gap:14, boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ textAlign:'center', minWidth:52 }}>
            <div style={{ fontSize:22, fontWeight:800, color:atsColor, lineHeight:1 }}>{atsScore}</div>
            <div style={{ fontSize:9, color:'#9CA3AF', fontWeight:700, textTransform:'uppercase', marginTop:2 }}>ATS Score</div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:12, fontWeight:700, color:atsColor }}>{atsLabel}</span>
              <span style={{ fontSize:11, color:'#9CA3AF' }}>{atsScore}/100</span>
            </div>
            <div style={{ height:6, background:'#F3F4F6', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:atsScore+'%', background:atsColor, borderRadius:99, transition:'width .5s ease' }}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {urgentCnt > 0 && <span style={{ padding:'3px 9px', borderRadius:20, background:'#FEE2E2', color:'#991B1B', fontSize:11, fontWeight:700 }}>{urgentCnt} urgent</span>}
            {improveCnt > 0 && <span style={{ padding:'3px 9px', borderRadius:20, background:'#FEF3C7', color:'#92400E', fontSize:11, fontWeight:700 }}>{improveCnt} improve</span>}
          </div>
          <button onClick={function(){setRightTab('health');}}
            style={{ padding:'6px 13px', borderRadius:8, border:'1px solid '+G, background:'white', fontSize:12, fontWeight:700, cursor:'pointer', color:GD, fontFamily:'inherit', flexShrink:0 }}>
            View Report
          </button>
        </div>

        {/* Personal Info */}
        <div style={sec}>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:14 }}>
            <div style={{ width:4, height:22, background:G, borderRadius:99 }}></div>
            <span style={{ fontSize:14, fontWeight:800, color:'#0D1B2A' }}>Personal Info</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:11 }}>
            {[['Full Name','name','text'],['Email','email','email'],['Phone','phone','tel'],['Location','location','text'],['LinkedIn URL','linkedin','url'],['GitHub URL','github','url']].map(function(item){
              return (
                <div key={item[1]}>
                  <label style={lbl}>{item[0]}</label>
                  <input value={header[item[1]]||''} onChange={function(e){updateHeader(item[1],e.target.value);}} placeholder={item[0]} type={item[2]}
                    style={inp} onFocus={function(e){e.target.style.borderColor=G;}} onBlur={function(e){e.target.style.borderColor='#E5E7EB';}}/>
                </div>
              );
            })}
          </div>
        </div>

        {/* Professional Summary */}
        <div style={sec}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:4, height:22, background:'#7C3AED', borderRadius:99 }}></div>
              <span style={{ fontSize:14, fontWeight:800, color:'#0D1B2A' }}>Professional Summary</span>
            </div>
            <button onClick={handleGenerateSummary} disabled={genSummary}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, border:'none', background:genSummary?'#E5E7EB':'linear-gradient(135deg,#7C3AED,#9333EA)', color:genSummary?'#9CA3AF':'white', fontSize:12, fontWeight:700, cursor:genSummary?'not-allowed':'pointer', fontFamily:'inherit' }}>
              <span>{genSummary?'...':'*'}</span>{genSummary?'Writing...':'AI Generate'}
            </button>
          </div>
          <textarea value={summary} onChange={function(e){setSummary(e.target.value);}} rows={5}
            placeholder="Write a 2-3 sentence professional summary, or click * AI Generate to create one automatically..."
            style={Object.assign({},inp,{resize:'vertical', lineHeight:1.7})}
            onFocus={function(e){e.target.style.borderColor='#7C3AED';}} onBlur={function(e){e.target.style.borderColor='#E5E7EB';}}/>
          <div style={{ fontSize:11, color:'#9CA3AF', marginTop:5 }}>{summary.split(' ').filter(Boolean).length} words . aim for 30-60</div>
        </div>

        {/* Technical Skills */}
        <div style={sec}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:4, height:22, background:'#F59E0B', borderRadius:99 }}></div>
              <span style={{ fontSize:14, fontWeight:800, color:'#0D1B2A' }}>Technical Skills</span>
              <span style={{ fontSize:11, color:'#9CA3AF' }}>({Object.values(skills).reduce(function(s,a){return s+a.length;},0)} skills)</span>
            </div>
            <button onClick={function(){setAddingGroup(function(s){return !s;});}}
              style={{ padding:'6px 14px', borderRadius:8, border:'1.5px solid '+G, background:'white', fontSize:12, fontWeight:700, cursor:'pointer', color:GD, fontFamily:'inherit' }}>
              + Add Category
            </button>
          </div>
          {addingGroup && (
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              <input value={newGroup} onChange={function(e){setNewGroup(e.target.value);}} placeholder="Category name (e.g. Security Tools)"
                style={Object.assign({},inp,{flex:1})} onKeyDown={function(e){if(e.key==='Enter')addSkillGroup();}}
                onFocus={function(e){e.target.style.borderColor=G;}} onBlur={function(e){e.target.style.borderColor='#E5E7EB';}}/>
              <button onClick={addSkillGroup}
                style={{ padding:'9px 18px', borderRadius:9, border:'none', background:G, color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>Add</button>
            </div>
          )}
          <div style={{ background:'#F9FAFB', borderRadius:10, padding:'12px 14px', border:'1px solid #F0F0F0' }}>
            {Object.entries(skills).map(function(entry){
              var grp=entry[0]; var vals=entry[1];
              return (
                <SkillGroup key={grp} label={grp} skills={vals}
                  onChange={function(nv){setSkills(function(s){var ns=Object.assign({},s);ns[grp]=nv;return ns;});}}
                  onDeleteGroup={function(){setSkills(function(s){var ns=Object.assign({},s);delete ns[grp];return ns;});}}/>
              );
            })}
          </div>
        </div>

        {/* Professional Experience */}
        <div style={sec}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:4, height:22, background:'#EF4444', borderRadius:99 }}></div>
              <span style={{ fontSize:14, fontWeight:800, color:'#0D1B2A' }}>Professional Experience</span>
            </div>
            <button onClick={addExp}
              style={{ padding:'6px 14px', borderRadius:8, border:'1.5px solid '+G, background:'white', fontSize:12, fontWeight:700, cursor:'pointer', color:GD, fontFamily:'inherit' }}>
              + Add Role
            </button>
          </div>
          {experiences.length === 0 && (
            <div style={{ textAlign:'center', padding:'24px', color:'#9CA3AF', fontSize:13, background:'#F9FAFB', borderRadius:10, border:'1px dashed #E5E7EB' }}>
              No experience entries yet - click "+ Add Role" to start
            </div>
          )}
          {experiences.map(function(exp,i){
            return (
              <div key={i} style={{ background:'#F9FAFB', borderRadius:12, border:'1px solid #F0F0F0', padding:'16px 18px', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:'#0D1B2A', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:11, fontWeight:800, flexShrink:0 }}>
                    {(exp.company||'?').charAt(0)}
                  </div>
                  <div style={{ flex:1, fontSize:13, fontWeight:700, color:'#0D1B2A' }}>{exp.company||('Role '+(i+1))}{exp.role?' - '+exp.role:''}</div>
                  <div style={{ display:'flex', gap:5 }}>
                    {i > 0 && <button onClick={function(){moveExp(i,-1);}} style={{ padding:'3px 7px', border:'1px solid #E5E7EB', background:'white', borderRadius:6, cursor:'pointer', fontSize:11 }}>^</button>}
                    {i < experiences.length-1 && <button onClick={function(){moveExp(i,1);}} style={{ padding:'3px 7px', border:'1px solid #E5E7EB', background:'white', borderRadius:6, cursor:'pointer', fontSize:11 }}>v</button>}
                    <button onClick={function(){delExp(i);}} style={{ padding:'3px 8px', border:'1px solid #FEE2E2', background:'#FFF5F5', borderRadius:6, cursor:'pointer', fontSize:11, color:'#EF4444' }}>Remove</button>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12 }}>
                  {[['Company / Client','company'],['Job Title','role'],['Date Range','dates'],['Location','location'],['Client (optional)','client']].map(function(item){
                    return (
                      <div key={item[1]}>
                        <label style={lbl}>{item[0]}</label>
                        <input value={exp[item[1]]||''} onChange={function(e){updExp(i,item[1],e.target.value);}} placeholder={item[0]}
                          style={inp} onFocus={function(e){e.target.style.borderColor=G;}} onBlur={function(e){e.target.style.borderColor='#E5E7EB';}}/>
                      </div>
                    );
                  })}
                </div>
                <label style={lbl}>Bullet Points <span style={{ color:'#9CA3AF', textTransform:'none', fontWeight:400, fontSize:10 }}>(paste bullet text to auto-split)</span></label>
                <BulletEditor bullets={exp.bullets||[]} onChange={function(b){updExp(i,'bullets',b);}}/>
                <div style={{ marginTop:8, fontSize:11, color:(exp.bullets||[]).length >= 3 ? G : '#F59E0B' }}>
                  {(exp.bullets||[]).length} bullets {(exp.bullets||[]).length < 3 ? '- aim for at least 3' : 'OK'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Certifications */}
        <div style={sec}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:4, height:22, background:'#3B82F6', borderRadius:99 }}></div>
              <span style={{ fontSize:14, fontWeight:800, color:'#0D1B2A' }}>Certifications</span>
            </div>
            <button onClick={addCert}
              style={{ padding:'6px 14px', borderRadius:8, border:'1.5px solid '+G, background:'white', fontSize:12, fontWeight:700, cursor:'pointer', color:GD, fontFamily:'inherit' }}>
              + Add Cert
            </button>
          </div>
          {certifications.length === 0 && (
            <div style={{ textAlign:'center', padding:'16px', color:'#9CA3AF', fontSize:12, background:'#F9FAFB', borderRadius:10, border:'1px dashed #E5E7EB' }}>No certifications yet</div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {certifications.map(function(c,i){
              return (
                <div key={i} style={{ background:'#F9FAFB', borderRadius:10, padding:'11px 13px', border:'1px solid #F0F0F0', display:'flex', gap:8, alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <input value={c.name||''} onChange={function(e){updCert(i,'name',e.target.value);}} placeholder="Certification name"
                      style={Object.assign({},inp,{marginBottom:6})} onFocus={function(e){e.target.style.borderColor=G;}} onBlur={function(e){e.target.style.borderColor='#E5E7EB';}}/>
                    <input value={c.date||''} onChange={function(e){updCert(i,'date',e.target.value);}} placeholder="Year (e.g. 2023)"
                      style={inp} onFocus={function(e){e.target.style.borderColor=G;}} onBlur={function(e){e.target.style.borderColor='#E5E7EB';}}/>
                  </div>
                  <button onClick={function(){delCert(i);}} style={{ border:'none', background:'none', cursor:'pointer', color:'#9CA3AF', fontSize:16, marginTop:6, padding:'2px 4px', transition:'color .15s' }}
                    onMouseEnter={function(e){e.currentTarget.style.color='#EF4444';}}
                    onMouseLeave={function(e){e.currentTarget.style.color='#9CA3AF';}}>x</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Education */}
        <div style={sec}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:4, height:22, background:'#A855F7', borderRadius:99 }}></div>
              <span style={{ fontSize:14, fontWeight:800, color:'#0D1B2A' }}>Education</span>
            </div>
            <button onClick={addEdu}
              style={{ padding:'6px 14px', borderRadius:8, border:'1.5px solid '+G, background:'white', fontSize:12, fontWeight:700, cursor:'pointer', color:GD, fontFamily:'inherit' }}>
              + Add Education
            </button>
          </div>
          {education.length === 0 && (
            <div style={{ textAlign:'center', padding:'16px', color:'#9CA3AF', fontSize:12, background:'#F9FAFB', borderRadius:10, border:'1px dashed #E5E7EB' }}>No education entries yet</div>
          )}
          {education.map(function(e,i){
            return (
              <div key={i} style={{ background:'#F9FAFB', borderRadius:10, padding:'13px 15px', border:'1px solid #F0F0F0', marginBottom:8 }}>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 2fr auto', gap:10, marginBottom:10 }}>
                  <div><label style={lbl}>School / University</label><input value={e.school||''} onChange={function(ev){updEdu(i,'school',ev.target.value);}} placeholder="University name" style={inp} onFocus={function(ev){ev.target.style.borderColor=G;}} onBlur={function(ev){ev.target.style.borderColor='#E5E7EB';}}/></div>
                  <div><label style={lbl}>Degree</label><input value={e.degree||''} onChange={function(ev){updEdu(i,'degree',ev.target.value);}} placeholder="Bachelor's, Computer Science" style={inp} onFocus={function(ev){ev.target.style.borderColor=G;}} onBlur={function(ev){ev.target.style.borderColor='#E5E7EB';}}/></div>
                  <button onClick={function(){delEdu(i);}} style={{ marginTop:20, border:'none', background:'none', cursor:'pointer', color:'#9CA3AF', fontSize:16 }}
                    onMouseEnter={function(e){e.currentTarget.style.color='#EF4444';}}
                    onMouseLeave={function(e){e.currentTarget.style.color='#9CA3AF';}}>x</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10 }}>
                  {[['Start','start'],['End','end'],['GPA (optional)','gpa'],['Location','location']].map(function(item){
                    return <div key={item[1]}><label style={lbl}>{item[0]}</label><input value={e[item[1]]||''} onChange={function(ev){updEdu(i,item[1],ev.target.value);}} placeholder={item[0]} style={inp} onFocus={function(ev){ev.target.style.borderColor=G;}} onBlur={function(ev){ev.target.style.borderColor='#E5E7EB';}}/></div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display:'flex', gap:9, marginBottom:40 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding:'10px 24px', borderRadius:10, border:'none', background:saving?'#E5E7EB':'linear-gradient(135deg,#00C982,#009963)', color:saving?'#9CA3AF':'white', fontSize:14, fontWeight:700, cursor:saving?'not-allowed':'pointer', fontFamily:'inherit', boxShadow:saving?'none':'0 4px 12px rgba(0,201,130,.3)' }}>
            {saving?'Saving...':'Save Resume'}
          </button>
          <button onClick={onBack}
            style={{ padding:'10px 18px', borderRadius:10, border:'1px solid #E5E7EB', background:'white', fontSize:14, fontWeight:700, cursor:'pointer', color:'#374151', fontFamily:'inherit' }}>
            Back
          </button>
          {!isNew && onDelete && (
            <button onClick={function(){onDelete(resume.id);}}
              style={{ padding:'10px 18px', borderRadius:10, border:'1.5px solid #EF4444', background:'white', fontSize:14, fontWeight:700, cursor:'pointer', color:'#EF4444', fontFamily:'inherit' }}>
              Delete
            </button>
          )}
        </div>
      </div>

      {/* -- RIGHT: Preview / Style / Health -- */}
      {/* Drag handle */}
      <div {...dragPreview.handleProps}/>

      {/* -- RIGHT: Preview/Style/Health -- */}
      <div style={{ width: dragPreview.width, background:'white', borderLeft:'none', display:'flex', flexDirection:'column', flexShrink:0, minWidth:0 }}>

        {/* Right tab bar */}
        <div style={{ display:'flex', borderBottom:'1px solid #F0F0F0', flexShrink:0 }}>
          {[['preview','Preview'],['style','Style'],['health','Health Report']].map(function(t){
            var active = rightTab === t[0];
            return (
              <button key={t[0]} onClick={function(){setRightTab(t[0]);}}
                style={{ flex:1, padding:'12px 8px', border:'none', background:active?'white':'#FAFAFA', fontSize:12, fontWeight:active?700:500, color:active?'#0D1B2A':'#9CA3AF', borderBottom:active?'2px solid '+G:'2px solid transparent', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}>
                {t[1]}{t[0]==='health' && urgentCnt > 0 ? ' ('+urgentCnt+')' : ''}
              </button>
            );
          })}
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>

          {/* PREVIEW TAB */}
          {rightTab === 'preview' && (
            <div style={{ padding:'16px' }}>
              <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:8, fontWeight:600 }}>
                {template === 'classic' ? 'Classic Professional' : 'Executive Compact'} . Live Preview
              </div>
              <div style={{ border:'1px solid #E5E7EB', borderRadius:10, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,.08)' }}>
                {template === 'classic'
                  ? <ClassicPreview header={header} summary={summary} skills={skills} experiences={experiences} certifications={certifications} education={education}/>
                  : <ExecutivePreview header={header} summary={summary} skills={skills} experiences={experiences} certifications={certifications} education={education}/>
                }
              </div>
            </div>
          )}

          {/* STYLE TAB */}
          {rightTab === 'style' && (
            <div style={{ padding:'18px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#0D1B2A', marginBottom:4 }}>Choose Template</div>
              <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:14 }}>Affects how your resume looks when exported as DOCX</div>

              {/* Classic */}
              <div onClick={function(){setTemplate('classic');}}
                style={{ borderRadius:12, border:'2px solid '+(template==='classic'?G:'#E5E7EB'), padding:'12px', marginBottom:12, cursor:'pointer', background:template==='classic'?'#F0FDF7':'white', transition:'all .15s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#0D1B2A' }}>Classic Professional</div>
                    <div style={{ fontSize:11, color:'#6B7280' }}>Centered . Serif . ATS-safe . Universal</div>
                  </div>
                  {template === 'classic' && <span style={{ padding:'3px 9px', borderRadius:20, background:G, color:'white', fontSize:11, fontWeight:700 }}>Active</span>}
                </div>
                <div style={{ border:'1px solid #F0F0F0', borderRadius:8, overflow:'hidden', transform:'scale(.95)', transformOrigin:'top left', height:140, width:'105%' }}>
                  <ClassicPreview header={header} summary={summary} skills={skills} experiences={experiences} certifications={certifications} education={education}/>
                </div>
              </div>

              {/* Executive */}
              <div onClick={function(){setTemplate('executive');}}
                style={{ borderRadius:12, border:'2px solid '+(template==='executive'?G:'#E5E7EB'), padding:'12px', cursor:'pointer', background:template==='executive'?'#F0FDF7':'white', transition:'all .15s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#0D1B2A' }}>Executive Compact</div>
                    <div style={{ fontSize:11, color:'#6B7280' }}>Dense . Sans-serif . Senior engineers . 2-page</div>
                  </div>
                  {template === 'executive' && <span style={{ padding:'3px 9px', borderRadius:20, background:G, color:'white', fontSize:11, fontWeight:700 }}>Active</span>}
                </div>
                <div style={{ border:'1px solid #F0F0F0', borderRadius:8, overflow:'hidden', transform:'scale(.95)', transformOrigin:'top left', height:140, width:'105%' }}>
                  <ExecutivePreview header={header} summary={summary} skills={skills} experiences={experiences} certifications={certifications} education={education}/>
                </div>
              </div>

              <div style={{ marginTop:14, padding:'11px 13px', background:'#F9FAFB', borderRadius:10, border:'1px solid #F0F0F0', fontSize:11, color:'#6B7280', lineHeight:1.6 }}>
                 Both templates are ATS-compatible single-column layouts. Classic is best for traditional companies, Executive for senior roles with dense experience.
              </div>
            </div>
          )}

          {/* HEALTH REPORT TAB */}
          {rightTab === 'health' && (
            <div style={{ padding:'18px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#0D1B2A', marginBottom:4 }}>Resume Health Report</div>
              <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                <div style={{ flex:1, textAlign:'center', padding:'9px', background:'#FEF2F2', borderRadius:9 }}>
                  <div style={{ fontSize:18, fontWeight:700, color:'#EF4444' }}>{urgentCnt}</div>
                  <div style={{ fontSize:10, color:'#EF4444', fontWeight:600 }}>URGENT</div>
                </div>
                <div style={{ flex:1, textAlign:'center', padding:'9px', background:'#FEF3C7', borderRadius:9 }}>
                  <div style={{ fontSize:18, fontWeight:700, color:'#F59E0B' }}>{improveCnt}</div>
                  <div style={{ fontSize:10, color:'#F59E0B', fontWeight:600 }}>IMPROVE</div>
                </div>
                <div style={{ flex:1, textAlign:'center', padding:'9px', background:'#EFF6FF', borderRadius:9 }}>
                  <div style={{ fontSize:18, fontWeight:700, color:'#3B82F6' }}>{optionalCnt}</div>
                  <div style={{ fontSize:10, color:'#3B82F6', fontWeight:600 }}>OPTIONAL</div>
                </div>
              </div>

              {issues.length === 0 && (
                <div style={{ textAlign:'center', padding:'30px', background:'#F0FDF7', borderRadius:12, border:'1px solid #A7F3D0' }}>
                  <div style={{ fontSize:24, marginBottom:8 }}></div>
                  <div style={{ fontSize:13, fontWeight:700, color:GD }}>Excellent! No issues found.</div>
                  <div style={{ fontSize:12, color:'#6B7280', marginTop:4 }}>Your resume looks complete and well-structured.</div>
                </div>
              )}

              {issues.map(function(issue, i) {
                var colors = {
                  urgent:   { bg:'#FEF2F2', border:'#FCA5A5', color:'#991B1B', dot:'#EF4444', label:'URGENT' },
                  improve:  { bg:'#FEF3C7', border:'#FDE68A', color:'#92400E', dot:'#F59E0B', label:'IMPROVE' },
                  optional: { bg:'#EFF6FF', border:'#BFDBFE', color:'#1E40AF', dot:'#3B82F6', label:'OPTIONAL' },
                };
                var c = colors[issue.level];
                return (
                  <div key={i} style={{ padding:'10px 12px', background:c.bg, border:'1px solid '+c.border, borderRadius:9, marginBottom:7, display:'flex', gap:9, alignItems:'flex-start' }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:c.dot, flexShrink:0, marginTop:4 }}></div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:c.color, lineHeight:1.5 }}>{issue.msg}</div>
                    </div>
                    <span style={{ fontSize:9, fontWeight:700, color:c.color, flexShrink:0, marginTop:2 }}>{c.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
