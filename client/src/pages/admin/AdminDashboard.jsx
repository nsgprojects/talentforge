import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { monitoringApi } from '../../lib/api';

const G='#00C982', GD='#009963';

function StatCard({ value, label, color, icon }) {
  return (
    <div style={{ background:'white', borderRadius:13, padding:'18px 20px', border:'1px solid #F0F0F0', display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ width:46, height:46, borderRadius:13, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{icon}</div>
      <div>
        <div style={{ fontSize:26, fontWeight:800, color, lineHeight:1 }}>{value ?? '-'}</div>
        <div style={{ fontSize:12, color:'#6B7280', marginTop:3 }}>{label}</div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats,    setStats]    = useState(null);
  const [users,    setUsers]    = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const load = () => {
    Promise.all([monitoringApi.stats(), monitoringApi.users(), monitoringApi.activity(20)])
      .then(([s,u,a]) => { setStats(s); setUsers(u||[]); setActivity(a||[]); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, []);

  const online = users.filter(u => u.is_online);
  const ACTION_COLOR = { login:'#3B82F6', logout:'#9CA3AF', resume_parse:G, gap_analysis:'#F59E0B', bullet_generate:'#7C3AED', resume_export:'#7C3AED', jd_parse:'#06B6D4', create:G };

  return (
    <div style={{ padding:'24px 28px', background:'#F5F7F5', minHeight:'calc(100vh - 57px)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0D1B2A', margin:0 }}>Admin Overview</h1>
          <p style={{ fontSize:13, color:'#6B7280', margin:'3px 0 0' }}>Live stats . refreshes every 30s</p>
        </div>
        <button onClick={()=>navigate('/dashboard/optimizer')}
          style={{ padding:'9px 18px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#00C982,#009963)', color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>
          + Open Optimizer
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard value={stats?.recruiters}   label="Total Recruiters" color={G}      icon=""/>
        <StatCard value={online.length}        label="Online Now"       color="#3B82F6" icon=""/>
        <StatCard value={stats?.base_resumes}  label="Base Resumes"     color="#F59E0B" icon=""/>
        <StatCard value={stats?.today_actions} label="Actions Today"    color="#7C3AED" icon=""/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:14 }}>
        <div style={{ background:'white', borderRadius:14, border:'1px solid #F0F0F0', overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #F9FAFB', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:14, fontWeight:700, color:'#0D1B2A' }}>Recruiters</span>
            <button onClick={()=>navigate('/dashboard/users')} style={{ fontSize:12, color:G, fontWeight:700, border:`1px solid ${G}`, background:'white', borderRadius:7, padding:'3px 10px', cursor:'pointer' }}>Manage</button>
          </div>
          {loading ? <div style={{ padding:'40px', textAlign:'center', color:'#9CA3AF' }}>Loading...</div> : (
            users.slice(0,8).map(u=>(
              <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 18px', borderBottom:'1px solid #F9FAFB' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:u.is_online?G:'#E5E7EB' }}/>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#E6FAF2,#A7F3D0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:GD }}>{u.name?.charAt(0)}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#0D1B2A' }}>{u.name}</div>
                  <div style={{ fontSize:10, color:'#9CA3AF' }}>{u.is_online ? <span style={{ color:G }}>* {u.current_page||'Dashboard'}</span> : `Last seen ${u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'never'}`}</div>
                </div>
                <div style={{ fontSize:12, fontWeight:600, color:'#374151' }}>{u.base_resume_count||0} resumes</div>
              </div>
            ))
          )}
        </div>

        <div style={{ background:'white', borderRadius:14, border:'1px solid #F0F0F0', overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #F9FAFB', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:14, fontWeight:700, color:'#0D1B2A' }}>Live Activity</span>
            <button onClick={()=>navigate('/dashboard/monitor')} style={{ fontSize:12, color:G, fontWeight:700, border:`1px solid ${G}`, background:'white', borderRadius:7, padding:'3px 10px', cursor:'pointer' }}>Monitor</button>
          </div>
          <div style={{ maxHeight:340, overflowY:'auto' }}>
            {activity.slice(0,20).map(a=>(
              <div key={a.id} style={{ padding:'8px 14px', borderBottom:'1px solid #F9FAFB', display:'flex', gap:9 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:ACTION_COLOR[a.action_type]||'#E5E7EB', flexShrink:0, marginTop:5 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'#374151' }}><strong>{a.user_name}</strong> {a.action_type?.replace(/_/g,' ')}</div>
                  <div style={{ fontSize:10, color:'#9CA3AF' }}>{new Date(a.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              </div>
            ))}
            {activity.length===0 && !loading && <div style={{ padding:'30px', textAlign:'center', color:'#9CA3AF', fontSize:12 }}>No activity yet</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
