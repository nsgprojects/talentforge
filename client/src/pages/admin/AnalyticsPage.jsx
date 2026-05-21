import { useState, useEffect } from 'react';
import { monitoringApi } from '../../lib/api';
const G='#00C982';

export default function AnalyticsPage() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  useEffect(() => {
    monitoringApi.users().then(u=>setUsers(u||[])).catch(()=>{});
    monitoringApi.stats().then(s=>setStats(s)).catch(()=>{});
  }, []);

  const pad = { padding:'24px 28px', background:'#F5F7F5', minHeight:'calc(100vh - 57px)' };
  const card = { background:'white', borderRadius:14, border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.05)', padding:'18px 20px', marginBottom:14 };

  return (
    <div style={pad}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#0D1B2A', margin:0, letterSpacing:'-.5px' }}>Analytics</h1>
        <p style={{ fontSize:13, color:'#6B7280', margin:'3px 0 0' }}>Platform usage and performance overview</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {/* Activity per user chart */}
        <div style={card}>
          <div style={{ fontSize:14, fontWeight:700, color:'#0D1B2A', marginBottom:14 }}>Actions per recruiter</div>
          {users.map(u=>(
            <div key={u.id} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                <span style={{ fontWeight:600, color:'#374151' }}>{u.name}</span>
                <span style={{ color:G, fontWeight:700 }}>{u.actions_today||0} today</span>
              </div>
              <div style={{ height:7, background:'#F3F4F6', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', background:`linear-gradient(90deg,${G},#009963)`, borderRadius:99, width:`${Math.min(100,((u.actions_today||0)/20)*100)}%`, transition:'width .8s ease' }}/>
              </div>
            </div>
          ))}
        </div>
        {/* Resumes per user */}
        <div style={card}>
          <div style={{ fontSize:14, fontWeight:700, color:'#0D1B2A', marginBottom:14 }}>Resumes per recruiter</div>
          {users.map(u=>(
            <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #F9FAFB' }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:'#E6FAF2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:G }}>{u.name?.charAt(0)}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#0D1B2A' }}>{u.name}</div>
                <div style={{ fontSize:10, color:'#9CA3AF' }}>{u.email}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:14, fontWeight:700, color:G }}>{u.base_resume_count||0}</div>
                <div style={{ fontSize:10, color:'#9CA3AF' }}>base</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#7C3AED' }}>{u.tailored_resume_count||0}</div>
                <div style={{ fontSize:10, color:'#9CA3AF' }}>tailored</div>
              </div>
            </div>
          ))}
        </div>
        {/* Summary stats */}
        {stats && (
          <div style={{ ...card, gridColumn:'1/-1', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
            {[['Total Recruiters',stats.recruiters,G,''],['Base Resumes',stats.base_resumes,'#F59E0B',''],['Tailored Resumes',stats.tailored_resumes,'#7C3AED',''],['Actions Today',stats.today_actions,'#3B82F6','']].map(([l,v,c,i])=>(
              <div key={l} style={{ textAlign:'center', padding:'16px', background:'#F9FAFB', borderRadius:11 }}>
                <div style={{ fontSize:24, marginBottom:6 }}>{i}</div>
                <div style={{ fontSize:24, fontWeight:800, color:c }}>{v||0}</div>
                <div style={{ fontSize:12, color:'#9CA3AF' }}>{l}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
