import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [role,   setRole]  = useState('recruiter');
  const [email,  setEmail] = useState('');
  const [pwd,    setPwd]   = useState('');
  const [error,  setError] = useState('');

  const DEMO = {
    admin:     { email:'admin@talentforge.com',  password:'Admin@123' },
    recruiter: { email:'ravi@talentforge.com',   password:'Recruiter@123' },
  };

  const doLogin = async (e, demoRole) => {
    e?.preventDefault(); setError('');
    const creds = demoRole ? DEMO[demoRole] : { email, password: pwd };
    const r = await login(creds.email, creds.password);
    if (r.ok) navigate('/dashboard');
    else setError(r.error);
  };

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      {/* Left gradient panel */}
      <div style={{ width:'44%', background:'linear-gradient(145deg,#00C982,#009963 50%,#00794E)', display:'flex', flexDirection:'column', justifyContent:'center', padding:'60px 48px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-90, right:-90, width:300, height:300, borderRadius:'50%', background:'rgba(255,255,255,.08)' }}/>
        <div style={{ position:'absolute', bottom:-70, left:-50, width:230, height:230, borderRadius:'50%', background:'rgba(0,0,0,.09)' }}/>
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:40 }}>
            <div style={{ width:40, height:40, borderRadius:11, background:'rgba(255,255,255,.22)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'white', fontWeight:800 }}>+</div>
            <span style={{ fontSize:22, fontWeight:800, color:'white', letterSpacing:'-.5px' }}>TalentForge</span>
          </div>
          <h1 style={{ fontSize:36, fontWeight:800, color:'white', lineHeight:1.15, margin:'0 0 16px', letterSpacing:'-1px' }}>
            Build resumes that<br/><em>actually</em> land interviews
          </h1>
          <p style={{ color:'rgba(255,255,255,.82)', fontSize:14, lineHeight:1.7, marginBottom:36 }}>
            AI-powered IT staffing platform - upload resumes, analyze JDs, generate ATS-optimized bullets, and export directly to DOCX.
          </p>
          {['Upload DOCX/PDF/TXT - auto-parsed instantly','2-step AI: gap analysis then bullet generation','ATS match score with per-role gap breakdown','Python inserts bullets into original DOCX format','Full admin monitoring and analytics'].map(f=>(
            <div key={f} style={{ display:'flex', alignItems:'center', gap:9, marginBottom:11 }}>
              <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span style={{ color:'rgba(255,255,255,.9)', fontSize:13 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px', background:'#F8FAF8' }}>
        <div style={{ width:'100%', maxWidth:400 }}>
          <h2 style={{ fontSize:26, fontWeight:800, color:'#0D1B2A', margin:'0 0 4px', letterSpacing:'-.5px' }}>Welcome back</h2>
          <p style={{ color:'#6B7280', fontSize:14, margin:'0 0 28px' }}>Sign in to your TalentForge account</p>

          {/* Role selector */}
          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:9, textTransform:'uppercase', letterSpacing:'.6px' }}>Sign in as</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:22 }}>
            {[{id:'admin',icon:'',lbl:'Admin',desc:'Full access + monitoring'},{id:'recruiter',icon:'',lbl:'Recruiter',desc:'Resumes, optimizer, library'}].map(r=>(
              <button key={r.id} onClick={()=>setRole(r.id)} style={{ padding:'13px 10px', borderRadius:11, border:`2px solid ${role===r.id?'#00C982':'#E5E7EB'}`, background:role===r.id?'#E6FAF2':'white', cursor:'pointer', textAlign:'center', transition:'all .15s', fontFamily:'inherit' }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{r.icon}</div>
                <div style={{ fontSize:13, fontWeight:700, color:role===r.id?'#009963':'#0D1B2A', marginBottom:2 }}>{r.lbl}</div>
                <div style={{ fontSize:10, color:'#9CA3AF' }}>{r.desc}</div>
              </button>
            ))}
          </div>

          {error && <div style={{ padding:'11px 14px', background:'#FEE2E2', border:'1px solid #FCA5A5', borderRadius:10, color:'#991B1B', fontSize:13, marginBottom:16 }}>{error}</div>}

          <form onSubmit={doLogin}>
            {[['Email','email',email,setEmail,'you@company.com'],['Password','password',pwd,setPwd,'--------']].map(([lbl,type,val,set,ph])=>(
              <div key={lbl} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:5 }}>{lbl}</label>
                <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                  style={{ width:'100%', padding:'11px 13px', borderRadius:9, border:'2px solid #E5E7EB', fontSize:14, outline:'none', color:'#0D1B2A', transition:'border-color .15s' }}
                  onFocus={e=>e.target.style.borderColor='#00C982'} onBlur={e=>e.target.style.borderColor='#E5E7EB'}/>
              </div>
            ))}
            <button type="submit" disabled={loading} style={{ width:'100%', padding:'13px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00C982,#009963)', color:'white', fontSize:15, fontWeight:700, margin:'6px 0 18px', boxShadow:'0 4px 14px rgba(0,201,130,.4)', cursor:loading?'not-allowed':'pointer', opacity:loading?.7:1 }}>
              {loading ? '... Signing in...' : 'Sign In ->'}
            </button>
          </form>

          {/* Quick demo */}
          <div style={{ padding:'14px 16px', background:'#E6FAF2', borderRadius:11, border:'1px solid #A7F3D0' }}>
            <p style={{ fontSize:11, color:'#6B7280', margin:'0 0 8px', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px' }}>Quick Demo</p>
            <div style={{ display:'flex', gap:7 }}>
              {[{id:'admin',icon:'',lbl:'Admin'},{id:'recruiter',icon:'',lbl:'Recruiter'}].map(r=>(
                <button key={r.id} onClick={()=>doLogin(null,r.id)} style={{ flex:1, padding:'8px 4px', borderRadius:9, border:'none', background:'white', fontSize:13, fontWeight:700, color:'#009963', cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
                  {r.icon} {r.lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
