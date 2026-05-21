import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { resumeApi, jdApi, pointsApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const G  = '#00C982';
const GD = '#009963';

function Clock({ label, tz }) {
  const [time, setTime] = useState('');
  useEffect(() => {
    function update() {
      setTime(new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true, timeZone:tz }));
    }
    update();
    var iv = setInterval(update, 1000);
    return function() { clearInterval(iv); };
  }, [tz]);

  return (
    <div style={{ textAlign:'center', padding:'8px 14px', background:'rgba(255,255,255,.07)', borderRadius:9, minWidth:80 }}>
      <div style={{ fontSize:14, fontWeight:700, color:'white', letterSpacing:'.5px', fontVariantNumeric:'tabular-nums' }}>{time}</div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,.5)', marginTop:1, fontWeight:600 }}>{label}</div>
    </div>
  );
}

function StatCard({ value, label, color, icon, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ background:'white', borderRadius:13, padding:'18px 20px', border:'1px solid #F0F0F0', display:'flex', alignItems:'center', gap:14, cursor:onClick ? 'pointer' : 'default' }}>
      <div style={{ width:48, height:48, borderRadius:13, background:color + '18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{icon}</div>
      <div>
        <div style={{ fontSize:26, fontWeight:800, color:color, lineHeight:1 }}>{value !== undefined && value !== null ? value : '-'}</div>
        <div style={{ fontSize:12, color:'#6B7280', marginTop:3 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function RecruiterDashboard() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [jds,     setJds]     = useState([]);
  const [points,  setPoints]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      resumeApi.getBase(),
      jdApi.getAll(),
      pointsApi.getAll({ limit:5 }),
    ])
      .then(function(results) {
        setResumes(results[0] || []);
        setJds(results[1] || []);
        setPoints(results[2] || []);
      })
      .catch(console.error)
      .finally(function() { setLoading(false); });
  }, []);

  var appliedJDs    = jds.filter(function(j) { return j.status === 'applied'; }).length;
  var recentJDs     = jds.slice(0, 4);
  var recentResumes = resumes.slice(0, 3);
  var hour          = new Date().getHours();
  var greeting      = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  var firstName     = user && user.name ? user.name.split(' ')[0] : 'there';

  var quickActions = [
    { label:'+ New JD',        icon:'', to:'/dashboard/jobs' },
    { label:'Upload Resume',   icon:'', to:'/dashboard/resumes' },
    { label:'Run Optimizer',   icon:'+',  to:'/dashboard/optimizer' },
    { label:'Points Library',  icon:'', to:'/dashboard/library' },
  ];

  return (
    <div style={{ fontFamily:'system-ui,sans-serif' }}>
      {/* Hero */}
      <div style={{ background:'linear-gradient(135deg,#0D1B2A,#1E3A2F)', padding:'22px 28px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:'white', marginBottom:3 }}>Good {greeting}, {firstName} </div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,.6)' }}>Here is your job search overview</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Clock label="EST" tz="America/New_York"/>
          <Clock label="CST" tz="America/Chicago"/>
          <Clock label="PST" tz="America/Los_Angeles"/>
        </div>
      </div>

      <div style={{ padding:'20px 28px', background:'#F5F7F5' }}>
        {/* Quick actions */}
        <div style={{ display:'flex', gap:9, marginBottom:18 }}>
          {quickActions.map(function(a) {
            return (
              <button
                key={a.label}
                onClick={function() { navigate(a.to); }}
                style={{ flex:1, padding:'11px 10px', borderRadius:11, border:'1.5px solid #F0F0F0', background:'white', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontFamily:'inherit' }}>
                <span style={{ fontSize:16 }}>{a.icon}</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#0D1B2A' }}>{a.label}</span>
              </button>
            );
          })}
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
          <StatCard value={jds.length}     label="Job Descriptions" color="#3B82F6" icon="" sub={appliedJDs + ' applied'}  onClick={function() { navigate('/dashboard/jobs'); }}/>
          <StatCard value={resumes.length} label="Base Resumes"     color={G}       icon=""                                 onClick={function() { navigate('/dashboard/resumes'); }}/>
          <StatCard value={points.length}  label="Points Saved"     color="#7C3AED" icon=""                                 onClick={function() { navigate('/dashboard/library'); }}/>
          <StatCard value={appliedJDs}     label="Jobs Applied"     color="#F59E0B" icon=""/>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {/* Recent JDs */}
          <div style={{ background:'white', borderRadius:14, border:'1px solid #F0F0F0', overflow:'hidden' }}>
            <div style={{ padding:'13px 18px', borderBottom:'1px solid #F9FAFB', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:14, fontWeight:700, color:'#0D1B2A' }}>Recent Job Descriptions</span>
              <button onClick={function() { navigate('/dashboard/jobs'); }} style={{ fontSize:12, color:G, fontWeight:700, border:'1px solid ' + G, background:'white', borderRadius:7, padding:'3px 9px', cursor:'pointer' }}>View all</button>
            </div>
            {loading
              ? <div style={{ padding:'30px', textAlign:'center', color:'#9CA3AF' }}>Loading...</div>
              : recentJDs.length === 0
                ? <div style={{ padding:'30px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>No JDs yet. <button onClick={function() { navigate('/dashboard/jobs'); }} style={{ color:G, border:'none', background:'none', cursor:'pointer', fontWeight:700 }}>Add one  </button></div>
                : recentJDs.map(function(jd) {
                    return (
                      <div
                        key={jd.id}
                        onClick={function() { navigate('/dashboard/jobs'); }}
                        style={{ padding:'11px 18px', borderBottom:'1px solid #F9FAFB', cursor:'pointer', display:'flex', gap:10, alignItems:'center' }}>
                        <div style={{ width:32, height:32, borderRadius:8, background:'#0D1B2A', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:800, flexShrink:0 }}>
                          {(jd.company || jd.title || 'J').charAt(0)}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'#0D1B2A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{jd.title || 'Untitled'}</div>
                          <div style={{ fontSize:11, color:'#9CA3AF' }}>{jd.company || '-'} . {new Date(jd.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</div>
                        </div>
                        <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700, background:jd.status === 'applied' ? '#EDE9FE' : '#E6FAF2', color:jd.status === 'applied' ? '#7C3AED' : GD, flexShrink:0 }}>
                          {jd.status}
                        </span>
                      </div>
                    );
                  })
            }
          </div>

          {/* Recent Resumes */}
          <div style={{ background:'white', borderRadius:14, border:'1px solid #F0F0F0', overflow:'hidden' }}>
            <div style={{ padding:'13px 18px', borderBottom:'1px solid #F9FAFB', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:14, fontWeight:700, color:'#0D1B2A' }}>Base Resumes</span>
              <button onClick={function() { navigate('/dashboard/resumes'); }} style={{ fontSize:12, color:G, fontWeight:700, border:'1px solid ' + G, background:'white', borderRadius:7, padding:'3px 9px', cursor:'pointer' }}>Manage</button>
            </div>
            {loading
              ? <div style={{ padding:'30px', textAlign:'center', color:'#9CA3AF' }}>Loading...</div>
              : recentResumes.length === 0
                ? <div style={{ padding:'30px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>No resumes yet. <button onClick={function() { navigate('/dashboard/resumes'); }} style={{ color:G, border:'none', background:'none', cursor:'pointer', fontWeight:700 }}>Upload one  </button></div>
                : recentResumes.map(function(r) {
                    return (
                      <div
                        key={r.id}
                        onClick={function() { navigate('/dashboard/resumes'); }}
                        style={{ padding:'11px 18px', borderBottom:'1px solid #F9FAFB', cursor:'pointer', display:'flex', gap:10, alignItems:'center' }}>
                        <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,' + G + ',' + GD + ')', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:800, flexShrink:0 }}>
                          {(r.name || 'R').charAt(0)}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'#0D1B2A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
                          <div style={{ fontSize:11, color:'#9CA3AF' }}>V{r.version_number} . {r.tech_stack || 'General'}</div>
                        </div>
                        {r.ats_score > 0
                          ? <div style={{ textAlign:'center', flexShrink:0 }}>
                              <div style={{ fontSize:15, fontWeight:800, color:r.ats_score >= 70 ? G : r.ats_score >= 50 ? '#F59E0B' : '#EF4444' }}>{r.ats_score}%</div>
                              <div style={{ fontSize:9, color:'#9CA3AF' }}>ATS</div>
                            </div>
                          : <button
                              onClick={function(e) { e.stopPropagation(); navigate('/dashboard/optimizer'); }}
                              style={{ padding:'4px 10px', borderRadius:7, border:'1px solid ' + G, background:'white', fontSize:11, fontWeight:700, cursor:'pointer', color:GD, flexShrink:0 }}>
                              Optimize
                            </button>
                        }
                      </div>
                    );
                  })
            }
            {resumes.length > 3 && (
              <div style={{ padding:'10px 18px', fontSize:11, color:'#9CA3AF', textAlign:'center' }}>+{resumes.length - 3} more resumes</div>
            )}
          </div>
        </div>

        {/* Optimizer CTA */}
        <div style={{ marginTop:14, background:'linear-gradient(135deg,#0D1B2A,#1E3A2F)', borderRadius:14, padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'white', marginBottom:4 }}>Ready to optimize a resume?</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.6)' }}>Select a JD and resume, AI gap analysis, ATS bullets, export DOCX</div>
          </div>
          <button
            onClick={function() { navigate('/dashboard/optimizer'); }}
            style={{ padding:'11px 22px', borderRadius:10, border:'none', background:G, color:'white', fontSize:14, fontWeight:700, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap', marginLeft:20 }}>
            + Run Optimizer
          </button>
        </div>
      </div>
    </div>
  );
}
