import { useState } from 'react';

const G  = '#00C982';
const GD = '#009963';

function dedupe(roleAnalysis) {
  var seen = new Set();
  return (roleAnalysis || []).map(function(role) {
    var pts = (role.suggestedPoints || []).filter(function(p) {
      var k = (p.text || '').slice(0, 80).toLowerCase().replace(/\s+/g, ' ');
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return Object.assign({}, role, { suggestedPoints: pts });
  });
}

function buildInitialSelected(roles) {
  var obj = {};
  roles.forEach(function(_, i) { obj[i] = []; });
  return obj;
}

export default function PreviewStep({ analysis, onComplete, onBack, savedSelections }) {
  var roleAnalysis = analysis && analysis.roleAnalysis ? analysis.roleAnalysis : [];
  var deduped      = dedupe(roleAnalysis);

  var [activeRole, setActiveRole] = useState(0);
  // Restore saved selections if coming back from Export, otherwise start empty
  var [selected,   setSelected]   = useState(function() {
    if (savedSelections && Object.keys(savedSelections).length > 0) return savedSelections;
    return buildInitialSelected(deduped);
  });

  function toggle(ri, pi) {
    setSelected(function(prev) {
      var next = Object.assign({}, prev);
      var arr  = (next[ri] || []).slice();
      var idx  = arr.indexOf(pi);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(pi);
      next[ri] = arr;
      return next;
    });
  }

  function selectAll(ri) {
    setSelected(function(prev) {
      var next    = Object.assign({}, prev);
      var pts     = deduped[ri] && deduped[ri].suggestedPoints ? deduped[ri].suggestedPoints : [];
      next[ri]    = pts.map(function(_, i) { return i; });
      return next;
    });
  }

  function clearRole(ri) {
    setSelected(function(prev) {
      var next = Object.assign({}, prev);
      next[ri] = [];
      return next;
    });
  }

  function isSelected(ri, pi) {
    return (selected[ri] || []).indexOf(pi) >= 0;
  }

  var totalSelected = Object.values(selected).reduce(function(sum, arr) { return sum + (arr || []).length; }, 0);

  function buildPayload() {
    return deduped.map(function(role, ri) {
      var selIdxs  = selected[ri] || [];
      var bullets  = (role.suggestedPoints || [])
        .filter(function(_, pi) { return selIdxs.indexOf(pi) >= 0; })
        .map(function(p) { return (p.text || '').trim(); })
        .filter(Boolean);
      return {
        roleName: role.roleName || ('Role ' + (ri + 1)),
        company:  role.company  || '',
        dates:    role.dates    || '',
        bullets:  bullets,
      };
    }).filter(function(r) { return r.bullets.length > 0; });
  }

  var cur    = deduped[activeRole] || {};
  var curPts = cur.suggestedPoints || [];
  var existingBullets = cur.existingBullets || (analysis && analysis.existingPoints) || [];

  var confColors = {
    HIGH:   ['#D1FAE5', '#059669'],
    MEDIUM: ['#FEF3C7', '#92400E'],
    LOW:    ['#F3F4F6', '#6B7280'],
  };

  return (
    <div style={{ background:'white', borderRadius:14, padding:'20px 22px', border:'1px solid #F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,.05)', marginBottom:16 }}>
      <div style={{ fontSize:18, fontWeight:800, color:'#0D1B2A', marginBottom:4 }}>Preview &amp; Select Bullets</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>Click AI bullets to select. Selected bullets will be inserted into your resume.</div>

      {/* Role tabs */}
      <div style={{ display:'flex', gap:7, marginBottom:16, overflowX:'auto', paddingBottom:4 }}>
        {deduped.map(function(role, i) {
          var selCount = (selected[i] || []).length;
          var totCount = (role.suggestedPoints || []).length;
          var isActive = activeRole === i;
          return (
            <button
              key={i}
              onClick={function() { setActiveRole(i); }}
              style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'flex-start', gap:2, padding:'10px 14px', borderRadius:11, border:'2px solid ' + (isActive ? G : '#E5E7EB'), background:isActive ? '#E6FAF2' : 'white', cursor:'pointer', minWidth:130, fontFamily:'inherit' }}>
              <div style={{ fontSize:12, fontWeight:700, color:isActive ? GD : '#0D1B2A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:130 }}>
                {role.roleName || ('Role ' + (i + 1))}
              </div>
              <div style={{ fontSize:10, color:'#9CA3AF', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:130 }}>
                {role.company || ''}
              </div>
              <div style={{ fontSize:11, fontWeight:700, marginTop:2, color: selCount > 0 ? G : '#9CA3AF' }}>
                {selCount}/{totCount} selected
              </div>
            </button>
          );
        })}
      </div>

      {/* Role header */}
      {cur.roleName && (
        <div style={{ background:'#F9FAFB', borderRadius:10, padding:'11px 13px', border:'1px solid #F3F4F6', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div>
            <div style={{ fontWeight:700, color:'#0D1B2A', fontSize:13 }}>{cur.roleName}</div>
            <div style={{ fontSize:11, color:G }}>{cur.company}{cur.dates ? ' . ' + cur.dates : ''}</div>
          </div>
          <div style={{ display:'flex', gap:7 }}>
            <button onClick={function() { selectAll(activeRole); }} style={{ fontSize:11, padding:'4px 11px', borderRadius:7, border:'1px solid #E5E7EB', background:'white', cursor:'pointer', color:'#374151', fontWeight:600 }}>Select all</button>
            <button onClick={function() { clearRole(activeRole); }}  style={{ fontSize:11, padding:'4px 11px', borderRadius:7, border:'1px solid #E5E7EB', background:'white', cursor:'pointer', color:'#374151', fontWeight:600 }}>Clear</button>
          </div>
        </div>
      )}

      {/* Two columns */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        {/* Existing bullets */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#EF4444', display:'inline-block' }}></span>
            Existing bullets
          </div>
          {(existingBullets.length > 0 ? existingBullets : ['No existing bullets found.']).map(function(p, i) {
            return (
              <div key={i} style={{ display:'flex', gap:6, padding:'6px 8px', borderRadius:7, background:'#FFF5F5', border:'1px solid #FEE2E2', marginBottom:5, fontSize:11, color:'#374151', lineHeight:1.5 }}>
                <span style={{ flexShrink:0, color:'#EF4444' }}>-</span>
                <span>{p}</span>
              </div>
            );
          })}
        </div>

        {/* AI bullets */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:G, display:'inline-block' }}></span>
            AI bullets ({curPts.length}) - click to select
          </div>
          {curPts.map(function(p, i) {
            var sel     = isSelected(activeRole, i);
            var conf    = p.confidence || 'MEDIUM';
            var colors  = confColors[conf] || confColors.MEDIUM;
            return (
              <div
                key={i}
                onClick={function() { toggle(activeRole, i); }}
                style={{ display:'flex', gap:8, padding:'7px 9px', borderRadius:8, background:sel ? '#F0FDF7' : '#F9FAFB', border:'1px solid ' + (sel ? '#A7F3D0' : '#E5E7EB'), marginBottom:6, cursor:'pointer', lineHeight:1.5, transition:'all .15s' }}>
                <div style={{ width:16, height:16, borderRadius:4, flexShrink:0, marginTop:1, background:sel ? G : 'white', border:'2px solid ' + (sel ? G : '#D1D5DB'), display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:10 }}>
                  {sel ? 'v' : ''}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, color:'#374151', marginBottom:3 }}>{p.text}</div>
                  {p.rationale && <div style={{ fontSize:10, color:'#9CA3AF', fontStyle:'italic', marginBottom:3 }}>{p.rationale}</div>}
                  <span style={{ padding:'1px 6px', borderRadius:4, fontSize:10, fontWeight:700, background:colors[0], color:colors[1] }}>{conf}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ background:'#F9FAFB', borderRadius:10, padding:'11px 14px', border:'1px solid #F3F4F6', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ fontSize:13, color:'#374151' }}>
          <span style={{ fontWeight:800, color:G }}>{totalSelected}</span> points selected across{' '}
          <span style={{ fontWeight:800, color:G }}>{Object.values(selected).filter(function(a) { return (a || []).length > 0; }).length}</span> roles
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {deduped.map(function(_, i) {
            return <div key={i} style={{ width:8, height:8, borderRadius:'50%', background:(selected[i] || []).length > 0 ? G : '#E5E7EB' }}></div>;
          })}
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <button onClick={onBack} style={{ padding:'9px 18px', borderRadius:9, border:'1px solid #E5E7EB', background:'white', fontSize:13, fontWeight:700, cursor:'pointer', color:'#374151', fontFamily:'inherit' }}>Back</button>
        <button
          onClick={function() { onComplete(buildPayload(), selected); }}
          disabled={totalSelected === 0}
          style={{ padding:'9px 22px', borderRadius:9, border:'none', background:totalSelected === 0 ? '#E5E7EB' : 'linear-gradient(135deg,#00C982,#009963)', color:totalSelected === 0 ? '#9CA3AF' : 'white', fontSize:13, fontWeight:700, cursor:totalSelected === 0 ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
          Confirm {totalSelected} pts
        </button>
      </div>
    </div>
  );
}
