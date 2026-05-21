import { useState, useEffect } from 'react';
import { monitoringApi } from '../../lib/api';
const G='#00C982';

export default function MonitorPage() {
  const [users,    setUsers]    = useState([]);
  const [selected, setSelected] = useState(null);
  const [activity, setActivity] = useState([]);
  const [live,     setLive]     = useState([]);
  const [loading,  setLoading]  = useState(true);

  const load = () => {
    monitoringApi.users().then(u=>setUsers(u||[])).catch(console.error).finally(()=>setLoading(false));
    monitoringApi.activity(30).then(a=>setLive(a||[])).catch(()=>{});
  };
  useEffect(()=>{ load(); const iv=setInterval(load,15000); return()=>clearInterval(iv); },[]);

  const openUser = id => {
    setSelected(id);
    monitoringApi.userActivity(id).then(a=>setActivity(a||[])).catch(()=>{});
  };

  const online = users.filter(u=>u.is_online);
  const ACTION_ICON = { login:'',logout:'',resume_parse:'',gap_analysis:'',bullet_generate:'',resume_export:'',jd_parse:'',create:'+',view:'',copy_point:'' };
  const pad = { padding:'24px 28px', background:'#F5F7F5', minHeight:'calc(100vh - 57px)' };

  return (
    <div style={pad}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#0D1B2A', margin:0, letterSpacing:'-.5px' }}>Live Monitor</h1>
        <p style={{ fontSize:13, color:'#6B7280', margin:'3px 0 0' }}>{online.length} online now . refreshes every 15s</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 300px', gap:14 }}>
        {/* All users */}
        <div style={{ background:'white', borderRadius:14, border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.05)', overflow:'hidden' }}>
          <div style={{ padding:'13px 16px', borderBottom:'1px solid #F9FAFB', fontSize:13, fontWeight:700, color:'#0D1B2A' }}>All Recruiters</div>
          {loading ? <div style={{ padding:'40px', textAlign:'center', color:'#9CA3AF' }}>Loading...</div> : users.map(u=>(
            <div key={u.id} onClick={()=>openUser(u.id)} style={{ padding:'11px 16px', borderBottom:'1px solid #F9FAFB', cursor:'pointer', background:selected===u.id?'#F0FDF7':'white', transition:'background .15s' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:u.is_online?G:'#E5E7EB', flexShrink:0 }}/>
                <span style={{ fontSize:13, fontWeight:600, color:'#0D1B2A' }}>{u.name}</span>
                {u.is_online && <span style={{ marginLeft:'auto', fontSize:10, color:G, fontWeight:700 }}>LIVE</span>}
              </div>
              <div style={{ fontSize:11, color:'#9CA3AF', paddingLeft:16 }}>
                {u.is_online ? `On: ${u.current_page||'Dashboard'}` : u.last_active_at ? `Last active ${new Date(u.last_active_at).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}` : 'Never active'}
              </div>
            </div>
          ))}
        </div>

        {/* Selected user activity */}
        <div style={{ background:'white', borderRadius:14, border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.05)', overflow:'hidden' }}>
          <div style={{ padding:'13px 16px', borderBottom:'1px solid #F9FAFB', fontSize:13, fontWeight:700, color:'#0D1B2A' }}>
            {selected ? `Activity - ${users.find(u=>u.id===selected)?.name||'User'}` : 'Select a recruiter'}
          </div>
          <div style={{ maxHeight:400, overflowY:'auto' }}>
            {!selected && <div style={{ padding:'40px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>Click a recruiter to see their activity</div>}
            {activity.map(a=>(
              <div key={a.id} style={{ padding:'9px 16px', borderBottom:'1px solid #F9FAFB', display:'flex', gap:9, alignItems:'flex-start' }}>
                <span style={{ fontSize:14, flexShrink:0 }}>{ACTION_ICON[a.action_type]||'-'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:'#374151', fontWeight:500 }}>{a.action_type.replace(/_/g,' ')}{a.entity_name&&<span style={{ color:G }}> . {a.entity_name}</span>}</div>
                  <div style={{ fontSize:10, color:'#9CA3AF' }}>{new Date(a.created_at).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              </div>
            ))}
            {selected&&activity.length===0&&<div style={{ padding:'30px', textAlign:'center', color:'#9CA3AF', fontSize:12 }}>No activity found</div>}
          </div>
        </div>

        {/* Live feed */}
        <div style={{ background:'white', borderRadius:14, border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.05)', overflow:'hidden', height:'fit-content' }}>
          <div style={{ padding:'13px 16px', borderBottom:'1px solid #F9FAFB', fontSize:13, fontWeight:700, color:'#0D1B2A', display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:G, display:'inline-block' }}/>Live feed
          </div>
          <div style={{ maxHeight:380, overflowY:'auto' }}>
            {live.slice(0,25).map(a=>(
              <div key={a.id} style={{ padding:'7px 14px', borderBottom:'1px solid #F9FAFB' }}>
                <div style={{ fontSize:11, color:'#374151' }}><strong style={{ color:'#0D1B2A' }}>{a.user_name}</strong> {a.action_type.replace(/_/g,' ')}</div>
                <div style={{ fontSize:10, color:'#9CA3AF' }}>{new Date(a.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
