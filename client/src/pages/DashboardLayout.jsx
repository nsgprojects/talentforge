import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const G='#00C982', GD='#009963';

const NAV = {
  admin: [
    { to:'/dashboard/home',       icon:'home',      label:'Home'           },
    null,
    { to:'/dashboard',            icon:'grid',      label:'Overview'       },
    { to:'/dashboard/monitor',    icon:'monitor',   label:'Monitor'        },
    { to:'/dashboard/analytics',  icon:'bar',       label:'Analytics'      },
    { to:'/dashboard/users',      icon:'users',     label:'Users'          },
    null,
    { to:'/dashboard/jobs',       icon:'briefcase', label:'Job Descriptions'},
    { to:'/dashboard/resumes',    icon:'file',      label:'Resumes'        },
    { to:'/dashboard/optimizer',  icon:'magic',     label:'Optimizer'      },
    { to:'/dashboard/library',    icon:'lib',       label:'Points Library' },
    null,
    { to:'/dashboard/settings',   icon:'settings',  label:'Settings'       },
  ],
  recruiter: [
    { to:'/dashboard/home',       icon:'home',      label:'Home'           },
    { to:'/dashboard/jobs',       icon:'briefcase', label:'Job Descriptions'},
    { to:'/dashboard/resumes',    icon:'file',      label:'Resumes'        },
    { to:'/dashboard/optimizer',  icon:'magic',     label:'Optimizer'      },
    { to:'/dashboard/library',    icon:'lib',       label:'Points Library' },
    null,
    { to:'/dashboard/settings',   icon:'settings',  label:'Settings'       },
  ],
};

const ICONS = {
  home:      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  grid:      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  users:     <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  file:      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  monitor:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  bar:       <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  lib:       <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  magic:     <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  briefcase: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  settings:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  logout:    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

const BADGE = {
  admin:     { label:'Admin',     bg:'#EDE9FE', color:'#7C3AED' },
  recruiter: { label:'Recruiter', bg:'#E6FAF2', color:GD },
};

export default function DashboardLayout() {
  const { user, logout, pingPage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const links    = NAV[user?.role] || [];
  const badge    = BADGE[user?.role] || {};

  useEffect(() => {
    if (user) {
      const page = location.pathname.split('/').filter(Boolean).pop() || 'dashboard';
      pingPage(page.charAt(0).toUpperCase() + page.slice(1));
    }
  }, [location.pathname]);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F5F7F5', fontFamily:'system-ui,sans-serif' }}>
      <aside style={{ width:220, background:'#0D1B2A', display:'flex', flexDirection:'column', position:'fixed', left:0, top:0, height:'100vh', zIndex:50, borderRight:'1px solid rgba(255,255,255,.05)', flexShrink:0 }}>
        {/* Logo */}
        <div style={{ padding:'18px 16px 14px', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }} onClick={()=>navigate('/dashboard/home')}>
            <div style={{ width:34, height:34, borderRadius:9, background:G, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, color:'white', fontWeight:800, flexShrink:0 }}>+</div>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:'white', letterSpacing:'-.3px' }}>TalentForge</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.35)', marginTop:1 }}>IT Staffing Platform</div>
            </div>
          </div>
        </div>

        {/* User */}
        <div style={{ padding:'11px 16px', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ width:30, height:30, borderRadius:'50%', background:`linear-gradient(135deg,${G},${GD})`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:800, flexShrink:0 }}>
              {user?.name?.charAt(0)}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
              <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, background:badge.bg, color:badge.color, fontWeight:700 }}>{badge.label}</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {links.map((l,i) => {
            if (l===null) return <div key={`d${i}`} style={{ height:1, background:'rgba(255,255,255,.07)', margin:'7px 6px' }}/>;
            return (
              <NavLink key={l.to} to={l.to} end={l.to==='/dashboard'}
                style={({ isActive }) => ({
                  display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:9, marginBottom:2,
                  textDecoration:'none', transition:'all .15s', cursor:'pointer',
                  background:isActive?'rgba(0,201,130,.14)':'transparent',
                  color:isActive?G:'rgba(255,255,255,.55)',
                })}>
                {({ isActive }) => (<>
                  <span style={{ flexShrink:0, color:isActive?G:'rgba(255,255,255,.4)' }}>{ICONS[l.icon]}</span>
                  <span style={{ fontSize:13, fontWeight:isActive?700:500 }}>{l.label}</span>
                  {isActive&&<span style={{ marginLeft:'auto', width:5, height:5, borderRadius:'50%', background:G }}/>}
                </>)}
              </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding:'8px', borderTop:'1px solid rgba(255,255,255,.06)' }}>
          <button onClick={handleLogout}
            style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 12px', borderRadius:9, border:'none', background:'transparent', color:'rgba(255,255,255,.4)', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}
            onMouseEnter={e=>{ e.currentTarget.style.background='rgba(239,68,68,.1)'; e.currentTarget.style.color='#EF4444'; }}
            onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,.4)'; }}>
            {ICONS.logout}
            <span style={{ fontSize:13, fontWeight:500 }}>Logout</span>
          </button>
        </div>
      </aside>

      <div style={{ marginLeft:220, flex:1, display:'flex', flexDirection:'column', minHeight:'100vh' }}>
        <header style={{ background:'white', borderBottom:'1px solid #F0F0F0', padding:'10px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:40, height:57 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ padding:'3px 11px', borderRadius:20, fontSize:11, fontWeight:700, background:badge.bg, color:badge.color }}>{badge.label}</span>
            <span style={{ fontSize:12, color:'#9CA3AF' }}>{user?.role==='admin'?'Super admin - full platform access':'Resume builder & optimizer'}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#374151' }}>{user?.name}</span>
            <div style={{ width:33, height:33, borderRadius:'50%', background:`linear-gradient(135deg,${G},${GD})`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:13 }}>{user?.name?.charAt(0)}</div>
          </div>
        </header>
        <main style={{ flex:1 }}><Outlet/></main>
      </div>
    </div>
  );
}
