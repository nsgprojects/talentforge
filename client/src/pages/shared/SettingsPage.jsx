import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { settingsApi, interviewApi } from '../../lib/api';

const G  = '#00C982';
const GD = '#009963';
const DK = '#0D1B2A';

function Card({ children, style }) {
  return (
    <div style={Object.assign({ background:'white', borderRadius:14, border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.04)', padding:'22px 24px', marginBottom:16 }, style)}>
      {children}
    </div>
  );
}
function SectionHead({ children, sub }) {
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ fontSize:15, fontWeight:800, color:DK }}>{children}</div>
      {sub && <div style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>{sub}</div>}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:5 }}>{label}</label>
      {children}
    </div>
  );
}
function Input({ value, onChange, placeholder, type, disabled, readOnly }) {
  return (
    <input type={type||'text'} value={value} onChange={onChange} placeholder={placeholder}
      disabled={disabled} readOnly={readOnly}
      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid '+(readOnly||disabled?'#F0F0F0':'#E5E7EB'), fontSize:13, outline:'none', color:readOnly||disabled?'#9CA3AF':DK, background:readOnly||disabled?'#FAFAFA':'white', boxSizing:'border-box', fontFamily:'inherit', transition:'border-color .15s' }}
      onFocus={function(e) { if (!readOnly && !disabled) e.target.style.borderColor=G; }}
      onBlur={function(e)  { if (!readOnly && !disabled) e.target.style.borderColor='#E5E7EB'; }}
    />
  );
}
function SaveBtn({ onClick, loading, label, color }) {
  var bg = color || 'linear-gradient(135deg,'+G+','+GD+')';
  return (
    <button onClick={onClick} disabled={loading}
      style={{ padding:'9px 22px', borderRadius:9, border:'none', background:loading?'#E5E7EB':bg, color:loading?'#9CA3AF':'white', fontSize:13, fontWeight:700, cursor:loading?'not-allowed':'pointer', fontFamily:'inherit' }}>
      {loading ? 'Saving...' : (label||'Save Changes')}
    </button>
  );
}
function Toast({ msg, type }) {
  if (!msg) return null;
  var colors = { success:['#D1FAE5','#059669'], error:['#FEE2E2','#DC2626'] };
  var c = colors[type] || colors.success;
  return (
    <div style={{ padding:'9px 14px', background:c[0], border:'1px solid', borderColor:c[1]+'40', borderRadius:9, fontSize:12, color:c[1], fontWeight:600, marginBottom:14 }}>
      {msg}
    </div>
  );
}

// ── Profile Section ────────────────────────────────────────
function ProfileSection() {
  var [form,    setForm]    = useState({ name:'', phone:'' });
  var [loading, setLoading] = useState(true);
  var [saving,  setSaving]  = useState(false);
  var [toast,   setToast]   = useState(null);
  var [email,   setEmail]   = useState('');

  useEffect(function() {
    settingsApi.getProfile().then(function(d) {
      setForm({ name: d.name||'', phone: d.phone||'' });
      setEmail(d.email||'');
    }).catch(console.error).finally(function() { setLoading(false); });
  }, []);

  var save = function() {
    if (!form.name.trim()) { setToast({ msg:'Name is required', type:'error' }); return; }
    setSaving(true);
    settingsApi.updateProfile({ name: form.name.trim(), phone: form.phone.trim() })
      .then(function() { setToast({ msg:'Profile updated successfully', type:'success' }); })
      .catch(function(e) { setToast({ msg:e.message, type:'error' }); })
      .finally(function() { setSaving(false); setTimeout(function() { setToast(null); }, 4000); });
  };

  return (
    <Card>
      <SectionHead sub="Update your display name and phone number">Profile</SectionHead>
      {toast && <Toast msg={toast.msg} type={toast.type}/>}
      {loading ? <div style={{ color:'#9CA3AF', fontSize:13 }}>Loading...</div> : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Field label="Full Name">
            <Input value={form.name} onChange={function(e) { setForm(function(f) { return Object.assign({},f,{name:e.target.value}); }); }} placeholder="Your full name"/>
          </Field>
          <Field label="Email (cannot be changed)">
            <Input value={email} readOnly/>
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={function(e) { setForm(function(f) { return Object.assign({},f,{phone:e.target.value}); }); }} placeholder="+1 555 000 0000"/>
          </Field>
        </div>
      )}
      <div style={{ marginTop:4 }}>
        <SaveBtn onClick={save} loading={saving}/>
      </div>
    </Card>
  );
}

// ── Password Section ───────────────────────────────────────
function PasswordSection() {
  var [form,   setForm]   = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  var [saving, setSaving] = useState(false);
  var [toast,  setToast]  = useState(null);
  var [show,   setShow]   = useState(false);

  var strength = function(p) {
    if (!p) return 0;
    var s = 0;
    if (p.length >= 8)         s++;
    if (/[A-Z]/.test(p))      s++;
    if (/[0-9]/.test(p))      s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };
  var str = strength(form.newPassword);
  var strColors = ['#EF4444','#F59E0B','#F59E0B',G,G];
  var strLabels = ['','Weak','Fair','Good','Strong'];

  var save = function() {
    if (!form.currentPassword || !form.newPassword) { setToast({ msg:'All fields required', type:'error' }); return; }
    if (form.newPassword !== form.confirmPassword)   { setToast({ msg:'Passwords do not match', type:'error' }); return; }
    setSaving(true);
    settingsApi.changePassword({ currentPassword:form.currentPassword, newPassword:form.newPassword, confirmPassword:form.confirmPassword })
      .then(function() {
        setToast({ msg:'Password changed successfully', type:'success' });
        setForm({ currentPassword:'', newPassword:'', confirmPassword:'' });
      })
      .catch(function(e) { setToast({ msg:e.message, type:'error' }); })
      .finally(function() { setSaving(false); setTimeout(function() { setToast(null); }, 5000); });
  };

  return (
    <Card>
      <SectionHead sub="Minimum 8 characters, one uppercase letter, one number">Change Password</SectionHead>
      {toast && <Toast msg={toast.msg} type={toast.type}/>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
        <Field label="Current Password">
          <Input value={form.currentPassword} onChange={function(e) { setForm(function(f) { return Object.assign({},f,{currentPassword:e.target.value}); }); }} type={show?'text':'password'} placeholder="Current password"/>
        </Field>
        <Field label="New Password">
          <Input value={form.newPassword} onChange={function(e) { setForm(function(f) { return Object.assign({},f,{newPassword:e.target.value}); }); }} type={show?'text':'password'} placeholder="New password"/>
          {form.newPassword && (
            <div style={{ marginTop:6 }}>
              <div style={{ display:'flex', gap:3, marginBottom:3 }}>
                {[1,2,3,4].map(function(i) {
                  return <div key={i} style={{ flex:1, height:3, borderRadius:99, background:str>=i?strColors[str]:'#F0F0F0', transition:'background .2s' }}/>;
                })}
              </div>
              <div style={{ fontSize:10, color:strColors[str], fontWeight:600 }}>{strLabels[str]}</div>
            </div>
          )}
        </Field>
        <Field label="Confirm Password">
          <Input value={form.confirmPassword} onChange={function(e) { setForm(function(f) { return Object.assign({},f,{confirmPassword:e.target.value}); }); }} type={show?'text':'password'} placeholder="Confirm new password"/>
          {form.confirmPassword && form.newPassword && (
            <div style={{ fontSize:11, marginTop:4, color:form.newPassword===form.confirmPassword?G:'#EF4444', fontWeight:600 }}>
              {form.newPassword===form.confirmPassword?'Passwords match':'Does not match'}
            </div>
          )}
        </Field>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <SaveBtn onClick={save} loading={saving} label="Change Password"/>
        <button onClick={function() { setShow(!show); }}
          style={{ fontSize:12, color:'#9CA3AF', border:'none', background:'none', cursor:'pointer', fontFamily:'inherit' }}>
          {show?'Hide':'Show'} passwords
        </button>
      </div>
    </Card>
  );
}

// ── Recruiter Preferences Section ─────────────────────────
function PreferencesSection() {
  var [prefs,   setPrefs]   = useState({ defaultTemplate:'classic', defaultTechStack:'', pointsDefaultSort:'newest', pointsDefaultEco:'' });
  var [loading, setLoading] = useState(true);
  var [saving,  setSaving]  = useState(false);
  var [toast,   setToast]   = useState(null);

  useEffect(function() {
    settingsApi.getProfile().then(function(d) {
      var p = d.preferences || {};
      setPrefs({
        defaultTemplate:  p.defaultTemplate  || 'classic',
        defaultTechStack: p.defaultTechStack || '',
        pointsDefaultSort:p.pointsDefaultSort|| 'newest',
        pointsDefaultEco: p.pointsDefaultEco || '',
      });
    }).catch(console.error).finally(function() { setLoading(false); });
  }, []);

  var set = function(key, val) { setPrefs(function(p) { return Object.assign({},p,{[key]:val}); }); };

  var save = function() {
    setSaving(true);
    settingsApi.updateProfile({ preferences: prefs })
      .then(function() { setToast({ msg:'Preferences saved', type:'success' }); })
      .catch(function(e) { setToast({ msg:e.message, type:'error' }); })
      .finally(function() { setSaving(false); setTimeout(function() { setToast(null); }, 3000); });
  };

  var sel = function(val, opts, onChange) {
    return (
      <select value={val} onChange={function(e) { onChange(e.target.value); }}
        style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:13, outline:'none', fontFamily:'inherit', color:DK }}>
        {opts.map(function(o) { return <option key={o[0]} value={o[0]}>{o[1]}</option>; })}
      </select>
    );
  };

  return (
    <Card>
      <SectionHead sub="Customize your default experience across the platform">Recruiter Preferences</SectionHead>
      {toast && <Toast msg={toast.msg} type={toast.type}/>}
      {loading ? <div style={{ color:'#9CA3AF', fontSize:13 }}>Loading...</div> : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Field label="Default Resume Template">
            {sel(prefs.defaultTemplate,[['classic','Classic Professional'],['executive','Executive Compact']],function(v){set('defaultTemplate',v);})}
            <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>Applied when creating a new resume</div>
          </Field>
          <Field label="Default Tech Stack">
            {sel(prefs.defaultTechStack,[['','Any'],['DevOps','DevOps'],['Cloud','Cloud'],['Java','Java'],['Python','Python'],['Fullstack','Fullstack'],['ML/AI','ML / AI'],['Security','Security'],['Salesforce','Salesforce']],function(v){set('defaultTechStack',v);})}
            <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>Pre-fills tech stack on new resume creation</div>
          </Field>
          <Field label="Points Library — Default Sort">
            {sel(prefs.pointsDefaultSort,[['newest','Newest first'],['relevance','By relevance'],['ecosystem','By ecosystem']],function(v){set('pointsDefaultSort',v);})}
          </Field>
          <Field label="Points Library — Default Ecosystem">
            {sel(prefs.pointsDefaultEco,[['','All ecosystems'],['DevOps','DevOps'],['Cloud','Cloud'],['Scripting','Scripting'],['Observability','Observability'],['Security','Security']],function(v){set('pointsDefaultEco',v);})}
          </Field>
        </div>
      )}
      <SaveBtn onClick={save} loading={saving}/>
    </Card>
  );
}

// ── Admin Platform Settings ────────────────────────────────
function PlatformSettingsSection() {
  var [form,    setForm]    = useState({ platform_name:'TalentForge', platform_tagline:'IT Staffing Platform', default_user_password:'Welcome@123' });
  var [loading, setLoading] = useState(true);
  var [saving,  setSaving]  = useState(false);
  var [toast,   setToast]   = useState(null);

  useEffect(function() {
    settingsApi.getPlatform().then(function(d) {
      setForm(function(f) {
        return {
          platform_name:         d.platform_name        ? d.platform_name.value         : f.platform_name,
          platform_tagline:      d.platform_tagline     ? d.platform_tagline.value       : f.platform_tagline,
          default_user_password: d.default_user_password? d.default_user_password.value  : f.default_user_password,
        };
      });
    }).catch(console.error).finally(function() { setLoading(false); });
  }, []);

  var save = async function() {
    setSaving(true);
    try {
      for (var [key, value] of Object.entries(form)) {
        await settingsApi.updatePlatform({ key, value });
      }
      setToast({ msg:'Platform settings saved', type:'success' });
    } catch(e) { setToast({ msg:e.message, type:'error' }); }
    finally { setSaving(false); setTimeout(function() { setToast(null); }, 4000); }
  };

  return (
    <Card>
      <SectionHead sub="Applies to all users on this platform">Platform Settings</SectionHead>
      {toast && <Toast msg={toast.msg} type={toast.type}/>}
      {loading ? <div style={{ color:'#9CA3AF', fontSize:13 }}>Loading...</div> : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
          <Field label="Platform Name">
            <Input value={form.platform_name} onChange={function(e) { setForm(function(f) { return Object.assign({},f,{platform_name:e.target.value}); }); }} placeholder="TalentForge"/>
          </Field>
          <Field label="Platform Tagline">
            <Input value={form.platform_tagline} onChange={function(e) { setForm(function(f) { return Object.assign({},f,{platform_tagline:e.target.value}); }); }} placeholder="IT Staffing Platform"/>
          </Field>
          <Field label="Default Password for New Users">
            <Input value={form.default_user_password} onChange={function(e) { setForm(function(f) { return Object.assign({},f,{default_user_password:e.target.value}); }); }} placeholder="Welcome@123"/>
            <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>New recruiter accounts are created with this password</div>
          </Field>
        </div>
      )}
      <SaveBtn onClick={save} loading={saving}/>
    </Card>
  );
}

// ── Admin Interview Questions Management ──────────────────
function InterviewManagementSection() {
  var [roles,      setRoles]      = useState([]);
  var [loading,    setLoading]    = useState(true);
  var [refreshing, setRefreshing] = useState({});
  var [refreshAll, setRefreshAll] = useState(false);
  var [toast,      setToast]      = useState(null);

  var load = function() {
    interviewApi.getAll().then(function(d) { setRoles(d||[]); }).catch(console.error).finally(function() { setLoading(false); });
  };
  useEffect(function() { load(); }, []);

  var refreshOne = function(roleId) {
    setRefreshing(function(r) { return Object.assign({},r,{[roleId]:true}); });
    interviewApi.refreshRole(roleId)
      .then(function() { setToast({ msg:'Questions refreshed for '+roleId, type:'success' }); load(); })
      .catch(function(e) { setToast({ msg:'Refresh failed: '+e.message, type:'error' }); })
      .finally(function() { setRefreshing(function(r) { return Object.assign({},r,{[roleId]:false}); }); setTimeout(function() { setToast(null); }, 4000); });
  };

  var refreshAllRoles = function() {
    setRefreshAll(true);
    setToast({ msg:'Refreshing all roles — this takes 2-3 minutes. Do not close this page.', type:'success' });
    interviewApi.refreshAll()
      .then(function(results) {
        var ok = results.filter(function(r) { return r.ok; }).length;
        setToast({ msg:'Refreshed '+ok+'/'+results.length+' roles successfully', type:'success' });
        load();
      })
      .catch(function(e) { setToast({ msg:'Refresh all failed: '+e.message, type:'error' }); })
      .finally(function() { setRefreshAll(false); setTimeout(function() { setToast(null); }, 8000); });
  };

  var daysAgo = function(dateStr) {
    if (!dateStr) return 'Never';
    var days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000*60*60*24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return days + ' days ago';
  };

  return (
    <Card>
      <SectionHead sub="Manage when interview questions are refreshed from Claude AI">Interview Questions Management</SectionHead>
      {toast && <Toast msg={toast.msg} type={toast.type}/>}
      <div style={{ padding:'10px 14px', background:'#E6FAF2', borderRadius:9, border:'1px solid #A7F3D0', marginBottom:14, fontSize:12, color:'#065F46', lineHeight:1.6 }}>
        Questions auto-refresh every 15 days in the background. Use manual refresh to force an immediate update for any role. "Refresh All" takes 2-3 minutes and runs Claude for all 10 roles.
      </div>
      {loading ? <div style={{ color:'#9CA3AF', fontSize:13 }}>Loading...</div> : (
        <div>
          <div style={{ borderRadius:10, overflow:'hidden', border:'1px solid #F0F0F0', marginBottom:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px auto', background:'#F9FAFB', padding:'8px 14px', borderBottom:'1px solid #F0F0F0' }}>
              {['Role','Last Updated','Source',''].map(function(h) {
                return <div key={h} style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.5px' }}>{h}</div>;
              })}
            </div>
            {roles.map(function(r, i) {
              var isStale = (Date.now() - new Date(r.refreshedAt).getTime()) > 15*24*60*60*1000;
              return (
                <div key={r.roleId} style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px auto', padding:'10px 14px', borderBottom: i < roles.length-1 ? '1px solid #F9FAFB' : 'none', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:DK }}>{r.roleLabel}</div>
                    <div style={{ fontSize:11, color:'#9CA3AF' }}>{r.questions?.length||0} questions</div>
                  </div>
                  <div style={{ fontSize:12, color:isStale?'#EF4444':'#6B7280', fontWeight:isStale?700:400 }}>{daysAgo(r.refreshedAt)}</div>
                  <div>
                    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700, background:r.refreshSource==='claude'?'#D1FAE5':'#F3F4F6', color:r.refreshSource==='claude'?GD:'#6B7280' }}>
                      {r.refreshSource}
                    </span>
                  </div>
                  <button onClick={function() { refreshOne(r.roleId); }} disabled={refreshing[r.roleId]}
                    style={{ padding:'5px 14px', borderRadius:8, border:'1px solid '+(isStale?'#EF4444':G), background:'white', fontSize:11, fontWeight:700, cursor:refreshing[r.roleId]?'not-allowed':'pointer', color:isStale?'#EF4444':G, fontFamily:'inherit' }}>
                    {refreshing[r.roleId]?'Refreshing...':'Refresh'}
                  </button>
                </div>
              );
            })}
          </div>
          <button onClick={refreshAllRoles} disabled={refreshAll}
            style={{ padding:'9px 22px', borderRadius:9, border:'none', background:refreshAll?'#E5E7EB':'linear-gradient(135deg,'+G+','+GD+')', color:refreshAll?'#9CA3AF':'white', fontSize:13, fontWeight:700, cursor:refreshAll?'not-allowed':'pointer', fontFamily:'inherit' }}>
            {refreshAll?'Refreshing all roles...':'Refresh All Roles with AI'}
          </button>
        </div>
      )}
    </Card>
  );
}

// ── MAIN SETTINGS PAGE ─────────────────────────────────────
export default function SettingsPage() {
  var { user } = useAuth();
  var isAdmin  = user && user.role === 'admin';

  return (
    <div style={{ padding:'24px 28px', background:'#F5F7F5', minHeight:'calc(100vh - 57px)', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontSize:20, fontWeight:800, color:DK, margin:0 }}>Settings</h1>
        <p style={{ fontSize:13, color:'#9CA3AF', margin:'4px 0 0' }}>
          {isAdmin ? 'Manage your profile, platform settings, and interview question refresh' : 'Manage your profile, password, and recruiter preferences'}
        </p>
      </div>

      <div style={{ maxWidth:900 }}>
        <ProfileSection/>
        <PasswordSection/>
        <PreferencesSection/>
        {isAdmin && <PlatformSettingsSection/>}
        {isAdmin && <InterviewManagementSection/>}
      </div>
    </div>
  );
}
