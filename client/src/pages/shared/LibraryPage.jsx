import { useState, useEffect, useCallback } from 'react';
import { pointsApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const G  = '#00C982';
const GD = '#009963';

function copyToClipboard(text) {
  // Try modern API first, fallback to execCommand
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(function() {
      legacyCopy(text);
    });
  }
  legacyCopy(text);
  return Promise.resolve();
}

function legacyCopy(text) {
  var el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity  = '0';
  document.body.appendChild(el);
  el.select();
  try { document.execCommand('copy'); } catch (e) { console.warn('copy failed', e); }
  document.body.removeChild(el);
}

function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;

  var items = [];
  var start = Math.max(1, page - 2);
  var end   = Math.min(pages, page + 2);

  if (start > 1) {
    items.push(1);
    if (start > 2) items.push('...');
  }
  for (var i = start; i <= end; i++) items.push(i);
  if (end < pages) {
    if (end < pages - 1) items.push('...');
    items.push(pages);
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:20, paddingTop:16, borderTop:'1px solid #F0F0F0' }}>
      <button
        onClick={function() { onPage(page - 1); }}
        disabled={page <= 1}
        style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', fontSize:13, cursor:page<=1?'not-allowed':'pointer', color:page<=1?'#9CA3AF':'#374151', fontFamily:'inherit' }}>Prev
      </button>
      {items.map(function(item, i) {
        if (item === '...') {
          return <span key={'dot' + i} style={{ color:'#9CA3AF', fontSize:13, padding:'0 4px' }}>...</span>;
        }
        var isActive = item === page;
        return (
          <button
            key={item}
            onClick={function() { onPage(item); }}
            style={{ width:34, height:34, borderRadius:8, border:'1.5px solid ' + (isActive ? G : '#E5E7EB'), background:isActive ? G : 'white', color:isActive ? 'white' : '#374151', fontSize:13, fontWeight:isActive ? 700 : 500, cursor:'pointer', fontFamily:'inherit' }}>
            {item}
          </button>
        );
      })}
      <button
        onClick={function() { onPage(page + 1); }}
        disabled={page >= pages}
        style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', fontSize:13, cursor:page>=pages?'not-allowed':'pointer', color:page>=pages?'#9CA3AF':'#374151', fontFamily:'inherit' }}>
        Next
      </button>
    </div>
  );
}

export default function LibraryPage() {
  const { user } = useAuth();

  var [points,  setPoints]  = useState([]);
  var [ecos,    setEcos]    = useState([]);
  var [eco,     setEco]     = useState('');
  var [search,  setSearch]  = useState('');
  var [page,    setPage]    = useState(1);
  var [total,   setTotal]   = useState(0);
  var [pages,   setPages]   = useState(1);
  var [loading, setLoading] = useState(true);
  var [copied,  setCopied]  = useState(null);

  var LIMIT = 20;

  function load(p, s, e) {
    setLoading(true);
    var params = { page: p || 1, limit: LIMIT };
    if (s) params.search = s;
    if (e) params.ecosystem = e;
    pointsApi.getAll(params)
      .then(function(res) {
        // Handle both old array response and new paginated response
        if (Array.isArray(res)) {
          setPoints(res);
          setTotal(res.length);
          setPages(1);
        } else {
          setPoints(res.data || []);
          setTotal(res.total || 0);
          setPages(res.pages || 1);
        }
      })
      .catch(console.error)
      .finally(function() { setLoading(false); });
  }

  useEffect(function() {
    pointsApi.getEcos().then(function(r) { setEcos(r || []); }).catch(function() {});
  }, []);

  useEffect(function() {
    setPage(1);
    load(1, search, eco);
  }, [eco]);

  var searchTimer = null;
  function handleSearch(val) {
    setSearch(val);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function() {
      setPage(1);
      load(1, val, eco);
    }, 400);
  }

  function handlePage(p) {
    setPage(p);
    load(p, search, eco);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCopy(pt) {
    copyToClipboard(pt.content);
    setCopied(pt.id);
    pointsApi.copy(pt.id).catch(function() {});
    setTimeout(function() { setCopied(null); }, 2000);
  }

  function handleDelete(id) {
    if (!confirm('Remove this point?')) return;
    pointsApi.remove(id).catch(function() {});
    setPoints(function(prev) { return prev.filter(function(p) { return p.id !== id; }); });
    setTotal(function(t) { return t - 1; });
  }

  // Group current page of points by ecosystem
  var ecoMap = {};
  points.forEach(function(p) {
    var key = p.ecosystem_name || 'General';
    if (!ecoMap[key]) ecoMap[key] = { color: p.color_hex || '#6B7280', pts: [] };
    ecoMap[key].pts.push(p);
  });

  var start = (page - 1) * LIMIT + 1;
  var end   = Math.min(page * LIMIT, total);

  return (
    <div style={{ padding:'24px 28px', minHeight:'calc(100vh - 57px)', background:'#F5F7F5', fontFamily:'system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0D1B2A', margin:0 }}>Points Library</h1>
          <p style={{ fontSize:13, color:'#6B7280', margin:'3px 0 0' }}>
            {user && user.role === 'admin' ? "All users' points" : 'Your saved points'}
            {total > 0 ? ' - ' + total + ' total' : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <input
          value={search}
          onChange={function(e) { handleSearch(e.target.value); }}
          placeholder="Search points..."
          style={{ padding:'9px 13px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:13, outline:'none', minWidth:240, color:'#374151', fontFamily:'inherit' }}
          onFocus={function(e) { e.target.style.borderColor = G; }}
          onBlur={function(e) { e.target.style.borderColor = '#E5E7EB'; }}
        />
        <select
          value={eco}
          onChange={function(e) { setEco(e.target.value); }}
          style={{ padding:'9px 13px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:13, outline:'none', color:'#374151', background:'white', cursor:'pointer', fontFamily:'inherit' }}>
          <option value="">All ecosystems</option>
          {ecos.map(function(e) {
            return <option key={e.id} value={e.name}>{e.name} ({e.point_count || 0})</option>;
          })}
        </select>
        {(eco || search) && (
          <button
            onClick={function() { setEco(''); setSearch(''); setPage(1); load(1, '', ''); }}
            style={{ padding:'9px 13px', borderRadius:9, border:'1px solid #E5E7EB', background:'white', fontSize:13, cursor:'pointer', color:'#374151', fontWeight:600, fontFamily:'inherit' }}>
            Clear filters
          </button>
        )}
        {total > 0 && (
          <span style={{ marginLeft:'auto', fontSize:12, color:'#9CA3AF' }}>
            Showing {start}-{end} of {total}
          </span>
        )}
      </div>

      {loading && <div style={{ padding:'60px', textAlign:'center', color:'#9CA3AF', fontSize:14 }}>Loading...</div>}

      {!loading && points.length === 0 && (
        <div style={{ background:'white', borderRadius:14, padding:'48px', textAlign:'center', border:'1px solid #F0F0F0' }}>
          <div style={{ fontSize:40, marginBottom:12 }}></div>
          <div style={{ fontSize:16, fontWeight:700, color:'#0D1B2A', marginBottom:6 }}>No points yet</div>
          <div style={{ fontSize:13, color:'#9CA3AF' }}>
            {user && user.role === 'admin' ? 'Points appear here as recruiters run the optimizer.' : 'Run the Resume Optimizer to generate and save points.'}
          </div>
        </div>
      )}

      {!loading && Object.entries(ecoMap).map(function(entry) {
        var name = entry[0];
        var group = entry[1];
        return (
          <div key={name} style={{ background:'white', borderRadius:14, border:'1px solid #F0F0F0', marginBottom:12, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            {/* Ecosystem header */}
            <div style={{ padding:'12px 18px', borderBottom:'1px solid #F9FAFB', display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:11, height:11, borderRadius:'50%', background:group.color, flexShrink:0 }}></div>
              <span style={{ fontSize:13, fontWeight:700, color:'#0D1B2A' }}>{name}</span>
              <span style={{ padding:'2px 8px', borderRadius:20, background:'#F3F4F6', color:'#6B7280', fontSize:11, fontWeight:600 }}>{group.pts.length}</span>
            </div>

            {/* Points */}
            <div style={{ padding:'8px 14px' }}>
              {group.pts.map(function(p) {
                var isCopied = copied === p.id;
                return (
                  <div key={p.id} style={{ display:'flex', gap:10, padding:'10px 10px', borderRadius:9, marginBottom:5, background:'#FAFAFA', border:'1px solid #F3F4F6', alignItems:'flex-start' }}>
                    <div style={{ flex:1, fontSize:13, color:'#374151', lineHeight:1.65 }}>{p.content}</div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
                      {p.experience_role && (
                        <span style={{ fontSize:11, color:'#9CA3AF', whiteSpace:'nowrap', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis' }}>
                          {p.experience_role}
                        </span>
                      )}
                      {user && user.role === 'admin' && p.created_by_name && (
                        <span style={{ fontSize:10, color:'#9CA3AF' }}> {p.created_by_name}</span>
                      )}
                      <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                        {p.usage_count > 0 && (
                          <span style={{ fontSize:10, color:'#9CA3AF' }}>x{p.usage_count}</span>
                        )}
                        <button
                          onClick={function() { handleCopy(p); }}
                          style={{ padding:'4px 12px', borderRadius:7, border:'1.5px solid ' + (isCopied ? G : '#E5E7EB'), background:isCopied ? '#E6FAF2' : 'white', color:isCopied ? GD : '#374151', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all .15s', whiteSpace:'nowrap' }}>
                          {isCopied ? 'v Copied' : 'Copy'}
                        </button>
                        <button
                          onClick={function() { handleDelete(p.id); }}
                          style={{ padding:'4px 8px', borderRadius:7, border:'1px solid #F0F0F0', background:'white', color:'#9CA3AF', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                          x
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Pagination */}
      {!loading && pages > 1 && (
        <Pagination page={page} pages={pages} onPage={handlePage}/>
      )}
    </div>
  );
}
