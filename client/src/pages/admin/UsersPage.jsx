import { useState, useEffect } from 'react';
import { usersApi } from '../../lib/api';

const G='#00C982', GD='#009963';

export default function UsersPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState({ name:'', email:'', phone:'', role:'recruiter' });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [created, setCreated] = useState(null);
  const [showForm,setShowForm]= useState(false);

  const load = () => usersApi.getAll().then(r=>setUsers(r||[])).catch(console.error).finally(()=>setLoading(false));
  useEffect(()=>{ load(); },[]);

  const handleCreate = async () => {
    if (!form.name||!form.email) { setError('Name and email required'); return; }
    setSaving(true); setError('');
    try {
      const res = await usersApi.create({ ...form });
      setCreated(res);
      setUsers(prev=>[res,...prev]);
      setForm({ name:'', email:'', phone:'', role:'recruiter' });
      setShowForm(false);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (u) => {
    const newStatus = u.status==='active'?'suspended':'active';
    try {
      await usersApi.update(u.id, { status:newStatus });
      setUsers(prev=>prev.map(x=>x.id===u.id?{...x,status:newStatus}:x));
    } catch(e) { alert(e.message); }
  };

  const promoteToAdmin = async (u) => {
    if (!confirm(`Promote ${u.name} to Admin? They will have full access.`)) return;
    try {
      await usersApi.update(u.id, { role:'admin' });
      setUsers(prev=>prev.map(x=>x.id===u.id?{...x,role:'admin'}:x));
    } catch(e) { alert(e.message); }
  };

  const demoteToRecruiter = async (u) => {
    if (!confirm(`Demote ${u.name} to Recruiter?`)) return;
    try {
      await usersApi.update(u.id, { role:'recruiter' });
      setUsers(prev=>prev.map(x=>x.id===u.id?{...x,role:'recruiter'}:x));
    } catch(e) { alert(e.message); }
  };

  const pad = { padding:'24px 28px', background:'#F5F7F5', minHeight:'calc(100vh - 57px)' };
  const card = { background:'white', borderRadius:14, border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.05)', overflow:'hidden' };

  return (
    <div style={pad}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0D1B2A', margin:0 }}>Users</h1>
          <p style={{ fontSize:13, color:'#6B7280', margin:'3px 0 0' }}>{users.length} account{users.length!==1?'s':''} (excluding you)</p>
        </div>
        <button onClick={()=>{ setShowForm(s=>!s); setCreated(null); setError(''); }}
          style={{ padding:'10px 20px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00C982,#009963)', color:'white', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(0,201,130,.3)' }}>
          {showForm?'x Cancel':'+ New User'}
        </button>
      </div>

      {created && (
        <div style={{ background:'#D1FAE5', border:'1px solid #A7F3D0', borderRadius:12, padding:'14px 18px', marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#059669', marginBottom:4 }}>v User created</div>
          <div style={{ fontSize:12, color:'#374151' }}>{created.name} . {created.email} . Role: <strong>{created.role}</strong></div>
          {created.tempPassword&&<div style={{ fontSize:12, marginTop:4 }}>Temp password: <code style={{ background:'#A7F3D0', padding:'1px 7px', borderRadius:5, fontWeight:700 }}>{created.tempPassword}</code></div>}
          <button onClick={()=>setCreated(null)} style={{ fontSize:11, color:'#059669', marginTop:8, border:'none', background:'transparent', cursor:'pointer', textDecoration:'underline' }}>Dismiss</button>
        </div>
      )}

      {showForm && (
        <div style={{ ...card, padding:'18px 20px', marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#0D1B2A', marginBottom:14 }}>Create new user</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:12 }}>
            {[['Full name','name','text','Jane Smith'],['Email','email','email','jane@company.com'],['Phone (optional)','phone','tel','+1 555-000-0000']].map(([lbl,key,type,ph])=>(
              <div key={key}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:'.5px' }}>{lbl}</label>
                <input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}
                  style={{ width:'100%', padding:'9px 11px', borderRadius:8, border:'2px solid #E5E7EB', fontSize:13, outline:'none', color:'#0D1B2A', boxSizing:'border-box' }}/>
              </div>
            ))}
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:'.5px' }}>Role</label>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}
                style={{ width:'100%', padding:'9px 11px', borderRadius:8, border:'2px solid #E5E7EB', fontSize:13, background:'white', cursor:'pointer', color:'#0D1B2A' }}>
                <option value="recruiter">Recruiter</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {error&&<div style={{ padding:'9px 12px', background:'#FEE2E2', borderRadius:8, fontSize:12, color:'#991B1B', marginBottom:10 }}>{error}</div>}
          <button onClick={handleCreate} disabled={saving}
            style={{ padding:'9px 20px', borderRadius:9, border:'none', background:saving?'#E5E7EB':'linear-gradient(135deg,#00C982,#009963)', color:saving?'#9CA3AF':'white', fontSize:13, fontWeight:700, cursor:saving?'not-allowed':'pointer' }}>
            {saving?'Creating...':'Create User ->'}
          </button>
        </div>
      )}

      <div style={card}>
        {loading?<div style={{ padding:'40px', textAlign:'center', color:'#9CA3AF' }}>Loading...</div>:
        users.length===0?<div style={{ padding:'40px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>No users yet. Create one above.</div>:
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #F0F0F0' }}>
              {['Name','Email','Role','Status','Resumes','JDs','Online','Actions'].map(h=>(
                <th key={h} style={{ padding:'11px 16px', fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.5px', textAlign:'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u=>(
              <tr key={u.id} style={{ borderBottom:'1px solid #F9FAFB' }}>
                <td style={{ padding:'12px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:u.role==='admin'?'linear-gradient(135deg,#7C3AED,#A855F7)':'linear-gradient(135deg,#E6FAF2,#A7F3D0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:u.role==='admin'?'white':GD, flexShrink:0 }}>{u.name?.charAt(0)}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#0D1B2A' }}>{u.name}</div>
                      {u.phone&&<div style={{ fontSize:10, color:'#9CA3AF' }}>{u.phone}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding:'12px 16px', fontSize:12, color:'#6B7280' }}>{u.email}</td>
                <td style={{ padding:'12px 16px' }}>
                  <span style={{ padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700, background:u.role==='admin'?'#EDE9FE':'#E6FAF2', color:u.role==='admin'?'#7C3AED':GD }}>
                    {u.role==='admin'?'Admin':'Recruiter'}
                  </span>
                </td>
                <td style={{ padding:'12px 16px' }}>
                  <span style={{ padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700, background:u.status==='active'?'#D1FAE5':u.status==='suspended'?'#FEE2E2':'#F3F4F6', color:u.status==='active'?'#059669':u.status==='suspended'?'#991B1B':'#6B7280' }}>{u.status}</span>
                </td>
                <td style={{ padding:'12px 16px', fontSize:12, fontWeight:600, color:'#374151' }}>{u.base_resume_count||0}</td>
                <td style={{ padding:'12px 16px', fontSize:12, fontWeight:600, color:'#374151' }}>{u.jd_count||0}</td>
                <td style={{ padding:'12px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:u.is_online?G:'#E5E7EB' }}/>
                    <span style={{ fontSize:11, color:u.is_online?G:'#9CA3AF', fontWeight:600 }}>{u.is_online?'Online':'Offline'}</span>
                  </div>
                </td>
                <td style={{ padding:'12px 16px' }}>
                  <div style={{ display:'flex', gap:5 }}>
                    <button onClick={()=>toggleStatus(u)}
                      style={{ padding:'4px 10px', borderRadius:7, border:'1px solid #E5E7EB', background:'white', fontSize:11, cursor:'pointer', color:u.status==='active'?'#EF4444':'#059669', fontWeight:600 }}>
                      {u.status==='active'?'Suspend':'Activate'}
                    </button>
                    {u.role==='recruiter' ? (
                      <button onClick={()=>promoteToAdmin(u)} style={{ padding:'4px 10px', borderRadius:7, border:'1px solid #EDE9FE', background:'#F5F3FF', fontSize:11, cursor:'pointer', color:'#7C3AED', fontWeight:600 }}>
                        Make Admin
                      </button>
                    ) : (
                      <button onClick={()=>demoteToRecruiter(u)} style={{ padding:'4px 10px', borderRadius:7, border:'1px solid #E6FAF2', background:'#F0FDF7', fontSize:11, cursor:'pointer', color:GD, fontWeight:600 }}>
                        Make Recruiter
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
    </div>
  );
}
