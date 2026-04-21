/* ============================================================
   VibeZ — App.js
   Complete app in one file. Uses React 18 via CDN (no build).
   ============================================================ */

const { useState, useEffect, useRef, useCallback } = React;

/* ──────────────────────────────────────────────────────────
   DATABASE  (in-memory, persists across re-renders)
   ────────────────────────────────────────────────────────── */
if (!window.__vz) {
  window.__vz = {
    users:    [],
    messages: [],
    requests: [],
    online:   {},
    privacy:  {},
  };
}
const DB = window.__vz;

/* ──────────────────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────────────────── */
const uid  = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const now  = () => Date.now();
const cid  = (a, b) => [a, b].sort().join('::');

const fmtTime = (t) =>
  new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const fmtDate = (t) => {
  const d = new Date(t), today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const accentColor = (name = '?') => {
  const cols = ['#7C3AED','#6D28D9','#5B21B6','#8B5CF6','#A78BFA','#9333EA'];
  let h = 0;
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return cols[Math.abs(h) % cols.length];
};

const initials = (name = '?') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const passwordStrength = (p) => {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 6)  s++;
  if (p.length >= 10) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
};

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['#333', '#EF4444', '#F59E0B', '#3B82F6', '#22C55E'];

const EMOJIS = [
  '😀','😂','😍','🥰','😎','🤔','😢','😡','👍','👎',
  '❤️','🔥','✨','🎉','💯','🙏','👀','💪','😭','🤣',
  '😊','😏','🥺','😴','🤗','💀','👋','🎊','🌟','💫',
  '⚡','🎯','🌈','💎','🚀','🍕','🎮','🏆','💰','🌸',
];

/* ──────────────────────────────────────────────────────────
   AUTH SERVICE
   ────────────────────────────────────────────────────────── */
const Auth = {
  signup(name, email, pass) {
    const e = email.trim().toLowerCase();
    if (!name.trim())  return { err: 'Name is required.' };
    if (!e)            return { err: 'Email is required.' };
    if (pass.length < 6) return { err: 'Password must be at least 6 characters.' };
    if (DB.users.find(u => u.email === e)) return { err: 'This email is already registered.' };

    const user = {
      id: uid(), name: name.trim(), email: e,
      pass, photo: null, bio: '', createdAt: now(),
    };
    DB.users.push(user);
    DB.online[user.id]  = now();
    DB.privacy[user.id] = { online: true, photo: true, bio: true, seen: true };
    return { user };
  },

  login(email, pass) {
    const e = email.trim().toLowerCase();
    if (!e)   return { err: 'Enter your email.' };
    if (!pass) return { err: 'Enter your password.' };
    const user = DB.users.find(u => u.email === e && u.pass === pass);
    if (!user) return { err: 'Wrong email or password.' };
    DB.online[user.id] = now();
    return { user };
  },

  ping(id)     { DB.online[id] = now(); },
  isOnline(id) { const l = DB.online[id]; return !!l && now() - l < 30000; },

  lastSeen(id) {
    const l = DB.online[id];
    if (!l) return 'never';
    const d = now() - l;
    if (d < 60000)   return 'just now';
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    if (d < 86400000)return `${Math.floor(d / 3600000)}h ago`;
    return fmtDate(l);
  },

  priv(id)        { return DB.privacy[id] || { online:true, photo:true, bio:true, seen:true }; },
  setPriv(id, p)  { DB.privacy[id] = { ...DB.privacy[id], ...p }; },

  updateProfile(id, fields) {
    const i = DB.users.findIndex(u => u.id === id);
    if (i !== -1) { DB.users[i] = { ...DB.users[i], ...fields }; return DB.users[i]; }
    return null;
  },
};

/* ──────────────────────────────────────────────────────────
   MESSAGES SERVICE
   ────────────────────────────────────────────────────────── */
const Msg = {
  send(from, to, text) {
    const m = { id: uid(), text, from, to, cid: cid(from, to), at: now(), gone: false };
    DB.messages.push(m);
    return m;
  },
  get(a, b) {
    const id = cid(a, b);
    return DB.messages
      .filter(m => m.cid === id && !m.gone)
      .sort((x, y) => x.at - y.at)
      .slice(-50);
  },
  vanish(a, b) {
    const id = cid(a, b);
    DB.messages.forEach(m => { if (m.cid === id) m.gone = true; });
  },
  last(a, b) {
    const id = cid(a, b);
    return DB.messages
      .filter(m => m.cid === id && !m.gone)
      .sort((x, y) => y.at - x.at)[0] || null;
  },
};

/* ──────────────────────────────────────────────────────────
   FRIENDS SERVICE
   ────────────────────────────────────────────────────────── */
const Fr = {
  send(from, to) {
    if (DB.requests.find(r =>
      (r.from === from && r.to === to) || (r.from === to && r.to === from)
    )) return;
    DB.requests.push({ id: uid(), from, to, st: 'pending', at: now() });
  },
  accept(rid)  { const r = DB.requests.find(r => r.id === rid); if (r) r.st = 'accepted'; },
  reject(rid)  { const r = DB.requests.find(r => r.id === rid); if (r) r.st = 'rejected'; },
  rel(a, b)    { return DB.requests.find(r =>
    (r.from === a && r.to === b) || (r.from === b && r.to === a)) || null; },
  incoming(id) { return DB.requests.filter(r => r.to === id && r.st === 'pending'); },
  sent(id)     { return DB.requests.filter(r => r.from === id && r.st === 'pending'); },
};

/* ──────────────────────────────────────────────────────────
   AVATAR COMPONENT
   ────────────────────────────────────────────────────────── */
function Avatar({ user, size = 40, showOnline = false }) {
  const p    = Auth.priv(user?.id);
  const isOn = showOnline && p.online && Auth.isOnline(user?.id);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {user?.photo && p.photo ? (
        <img src={user.photo} alt=""
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #7C3AED' }} />
      ) : (
        <div style={{
          width: size, height: size, borderRadius: '50%',
          background: `linear-gradient(135deg, ${accentColor(user?.name)}, ${accentColor((user?.name||'')+'1')})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.35, fontWeight: 700, color: '#fff',
          border: '2.5px solid #7C3AED',
        }}>
          {initials(user?.name)}
        </div>
      )}
      {showOnline && (
        <div style={{
          position: 'absolute', bottom: 1, right: 1,
          width: size * 0.28, height: size * 0.28, borderRadius: '50%',
          background: isOn ? '#22C55E' : '#374151',
          border: '2px solid #000', transition: 'background 0.3s',
        }} />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   PROFILE EDIT MODAL
   ────────────────────────────────────────────────────────── */
function ProfileModal({ user, onClose, onSave }) {
  const [name, setName]   = useState(user.name);
  const [bio,  setBio]    = useState(user.bio || '');
  const [photo, setPhoto] = useState(user.photo || null);
  const [priv,  setPriv]  = useState(Auth.priv(user.id));
  const fileRef = useRef();

  const save = () => {
    const updated = Auth.updateProfile(user.id, { name: name.trim() || user.name, bio, photo });
    Auth.setPriv(user.id, priv);
    onSave(updated || { ...user, name, bio, photo });
    onClose();
  };

  const privOpts = [
    ['online', 'Show online status'],
    ['seen',   'Show last seen'],
    ['photo',  'Show profile photo'],
    ['bio',    'Show bio to others'],
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-card fade-in">
        <div className="modal-header">
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>Edit Profile</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Photo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current.click()}>
            {photo ? (
              <img src={photo} alt=""
                style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', border: '3px solid #7C3AED' }} />
            ) : (
              <div style={{
                width: 84, height: 84, borderRadius: '50%',
                background: `linear-gradient(135deg, ${accentColor(name)}, #4C1D95)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 700, color: '#fff', border: '3px solid #7C3AED',
              }}>
                {initials(name)}
              </div>
            )}
            <div style={{
              position: 'absolute', bottom: 2, right: 2, background: '#7C3AED',
              borderRadius: '50%', width: 26, height: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, border: '2px solid #000',
            }}>📷</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files[0]; if (!f) return;
              const r = new FileReader();
              r.onload = ev => setPhoto(ev.target.result);
              r.readAsDataURL(f);
            }} />
          <span style={{ color: '#555', fontSize: 12, marginTop: 6 }}>Tap to change photo</span>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 13 }}>
          <label className="field-label">Display Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="field-input" placeholder="Your name" />
        </div>

        {/* Bio */}
        <div style={{ marginBottom: 20 }}>
          <label className="field-label">Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
            placeholder="Something about you..."
            style={{
              width: '100%', padding: '11px 14px', borderRadius: 12,
              background: '#111', border: '1.5px solid #222',
              color: '#fff', fontSize: 14, outline: 'none', resize: 'none',
              lineHeight: 1.5, boxSizing: 'border-box',
            }} />
        </div>

        {/* Privacy */}
        <div style={{ marginBottom: 24 }}>
          <label className="field-label">Privacy Settings</label>
          {privOpts.map(([k, l]) => (
            <div key={k} className="priv-row">
              <span style={{ color: '#ccc', fontSize: 13 }}>{l}</span>
              <div className="toggle-track"
                style={{ background: priv[k] ? '#7C3AED' : '#2a2a2a' }}
                onClick={() => setPriv(p => ({ ...p, [k]: !p[k] }))}>
                <div className="toggle-thumb" style={{ left: priv[k] ? 22 : 3 }} />
              </div>
            </div>
          ))}
        </div>

        <button onClick={save}
          style={{
            width: '100%', padding: '13px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
          }}>
          Save Changes
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   AUTH SCREEN  (Sign In / Sign Up)
   ────────────────────────────────────────────────────────── */
function AuthScreen({ onLogin }) {
  const [mode,  setMode]  = useState('login');
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err,   setErr]   = useState('');
  const [busy,  setBusy]  = useState(false);

  const strength = passwordStrength(pass);

  const switchMode = (m) => {
    setMode(m); setErr('');
    setName(''); setEmail(''); setPass(''); setShowPass(false);
  };

  const submit = () => {
    setErr('');
    setBusy(true);
    setTimeout(() => {
      const res = mode === 'signup'
        ? Auth.signup(name, email, pass)
        : Auth.login(email, pass);
      setBusy(false);
      if (res.err) { setErr(res.err); return; }
      onLogin(res.user);
    }, 300);
  };

  const onKey = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <div className="auth-page">
      <div className="auth-wrapper fade-in">

        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-text">VibeZ</span>
          <div className="auth-logo-sub">Private chats. Your vibe.</div>
          <div className="auth-logo-badge">🔒 End-to-end private</div>
        </div>

        {/* Card */}
        <div className="auth-card">

          {/* Tab switcher */}
          <div className="tab-switcher">
            {[['login','Sign In'], ['signup','Sign Up']].map(([id, l]) => (
              <button key={id} onClick={() => switchMode(id)}
                className={`tab-btn ${mode === id ? 'active' : 'inactive'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div className="field-group">
            {mode === 'signup' && (
              <div>
                <label className="field-label">Full Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={onKey} placeholder="Your full name"
                  autoComplete="name" className="field-input" />
              </div>
            )}

            <div>
              <label className="field-label">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={onKey} placeholder="you@example.com"
                autoComplete="email" className="field-input" />
            </div>

            <div>
              <label className="field-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'}
                  value={pass} onChange={e => setPass(e.target.value)}
                  onKeyDown={onKey}
                  placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="field-input"
                  style={{ paddingRight: 46 }} />
                <button onClick={() => setShowPass(s => !s)}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#555', cursor: 'pointer',
                    fontSize: 16, lineHeight: 1,
                  }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
              {/* Password strength (signup only) */}
              {mode === 'signup' && pass && (
                <div style={{ marginTop: 8 }}>
                  <div className="strength-bar-wrap">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="strength-seg"
                        style={{ background: i <= strength ? STRENGTH_COLORS[strength] : '#222' }} />
                    ))}
                  </div>
                  <div style={{ color: STRENGTH_COLORS[strength], fontSize: 11, marginTop: 4 }}>
                    {STRENGTH_LABELS[strength]}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {err && (
            <div className="auth-error">
              <span>⚠️</span> {err}
            </div>
          )}

          {/* Submit */}
          <button onClick={submit} disabled={busy}
            className={`auth-submit-btn ${busy ? 'loading' : 'ready'}`}>
            {busy
              ? <span className="loading-pulse">{mode === 'login' ? 'Signing in…' : 'Creating account…'}</span>
              : (mode === 'login' ? 'Sign In →' : 'Create Account →')
            }
          </button>

          {/* Switch */}
          <div className="auth-switch">
            {mode === 'login' ? 'New here? ' : 'Already have an account? '}
            <span className="auth-switch-link"
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   USERS LIST SCREEN
   ────────────────────────────────────────────────────────── */
function UsersListScreen({ me: initMe, onChat, onLogout }) {
  const [me,       setMe]       = useState(initMe);
  const [tab,      setTab]      = useState('people');
  const [search,   setSearch]   = useState('');
  const [showProf, setShowProf] = useState(false);
  const [tick,     setTick]     = useState(0);
  const rerender = () => setTick(t => t + 1);

  useEffect(() => {
    Auth.ping(me.id);
    const iv = setInterval(() => { Auth.ping(me.id); rerender(); }, 4000);
    return () => clearInterval(iv);
  }, [me.id]);

  const q       = search.toLowerCase();
  const others  = DB.users.filter(u => u.id !== me.id &&
    (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
  const friends = DB.users.filter(u => u.id !== me.id && Fr.rel(me.id, u.id)?.st === 'accepted');
  const inc     = Fr.incoming(me.id);
  const snt     = Fr.sent(me.id);

  /* Friend action button */
  const FrBtn = ({ user }) => {
    const r = Fr.rel(me.id, user.id);
    if (!r)
      return <button className="small-btn" style={{ background: '#7C3AED' }}
        onClick={() => { Fr.send(me.id, user.id); rerender(); }}>Add Friend</button>;
    if (r.st === 'pending' && r.from === me.id)
      return <span style={{ color: '#6B7280', fontSize: 12 }}>Sent ✓</span>;
    if (r.st === 'pending' && r.to === me.id)
      return (
        <div style={{ display: 'flex', gap: 5 }}>
          <button className="small-btn" style={{ background: '#22C55E' }}
            onClick={() => { Fr.accept(r.id); rerender(); }}>✓</button>
          <button className="small-btn" style={{ background: '#EF4444' }}
            onClick={() => { Fr.reject(r.id); rerender(); }}>✕</button>
        </div>
      );
    if (r.st === 'accepted')
      return <button className="small-btn" style={{ background: '#7C3AED' }}
        onClick={() => onChat(user)}>Chat</button>;
    return null;
  };

  /* Single user row */
  const Row = ({ user, onClick, right }) => {
    const p    = Auth.priv(user.id);
    const on   = p.online && Auth.isOnline(user.id);
    const last = Msg.last(me.id, user.id);
    return (
      <div className="user-row" onClick={onClick}>
        <Avatar user={user} size={50} showOnline />
        <div className="user-row-info">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="user-row-name">{user.name}</div>
            {last && <span style={{ color: '#333', fontSize: 11, flexShrink: 0 }}>{fmtTime(last.at)}</span>}
          </div>
          <div className="user-row-sub">
            {last
              ? (last.from === me.id ? `You: ${last.text}` : last.text)
              : on ? '🟢 Online'
              : p.seen ? `Last seen ${Auth.lastSeen(user.id)}`
              : user.email}
          </div>
        </div>
        {right && <div onClick={e => e.stopPropagation()}>{right}</div>}
      </div>
    );
  };

  const tabs = [
    ['people',   'People'],
    ['friends',  `Friends${friends.length ? ` (${friends.length})` : ''}`],
    ['requests', `Requests${inc.length    ? ` · ${inc.length}`     : ''}`],
  ];

  return (
    <div className="screen">
      {/* Header */}
      <div className="list-header">
        <div className="list-header-top">
          <div className="vibez-wordmark">VibeZ</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {inc.length > 0 && <div className="notif-badge">{inc.length}</div>}
            <div style={{ cursor: 'pointer' }} onClick={() => setShowProf(true)}>
              <Avatar user={me} size={37} showOnline />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search people..." className="search-input" />
        </div>

        {/* Tabs */}
        <div className="nav-tabs">
          {tabs.map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`nav-tab ${tab === id ? 'active' : ''}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* List body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* People tab */}
        {tab === 'people' && (
          others.length === 0
            ? <Empty icon="👥" text={search ? 'No users found.' : 'No other users yet!'} />
            : others.map(u => (
                <Row key={u.id} user={u}
                  onClick={Fr.rel(me.id, u.id)?.st === 'accepted' ? () => onChat(u) : undefined}
                  right={<FrBtn user={u} />} />
              ))
        )}

        {/* Friends tab */}
        {tab === 'friends' && (
          friends.length === 0
            ? <Empty icon="🤝" text="No friends yet. Send some requests!" />
            : friends.map(u => (
                <Row key={u.id} user={u} onClick={() => onChat(u)}
                  right={
                    <button className="small-btn" style={{ background: '#7C3AED' }}
                      onClick={() => onChat(u)}>Chat</button>
                  } />
              ))
        )}

        {/* Requests tab */}
        {tab === 'requests' && (
          <>
            {inc.length > 0 && (
              <>
                <div className="section-label">Incoming Requests</div>
                {inc.map(r => {
                  const f = DB.users.find(u => u.id === r.from);
                  return f && (
                    <div key={r.id} className="user-row" style={{ cursor: 'default' }}>
                      <Avatar user={f} size={46} />
                      <div className="user-row-info">
                        <div className="user-row-name">{f.name}</div>
                        <div className="user-row-sub">{f.email}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                        <button className="small-btn" style={{ background: '#22C55E' }}
                          onClick={() => { Fr.accept(r.id); rerender(); }}>Accept</button>
                        <button className="small-btn"
                          style={{ background: '#111', border: '1px solid #333', color: '#EF4444' }}
                          onClick={() => { Fr.reject(r.id); rerender(); }}>Decline</button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            {snt.length > 0 && (
              <>
                <div className="section-label">Sent Requests</div>
                {snt.map(r => {
                  const t = DB.users.find(u => u.id === r.to);
                  return t && (
                    <div key={r.id} className="user-row" style={{ cursor: 'default' }}>
                      <Avatar user={t} size={46} />
                      <div className="user-row-info">
                        <div className="user-row-name">{t.name}</div>
                        <div className="user-row-sub" style={{ color: '#7C3AED' }}>Pending…</div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            {inc.length === 0 && snt.length === 0 && <Empty icon="📨" text="No pending requests." />}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="footer-bar">
        <div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{me.name}</div>
          <div style={{ color: '#22C55E', fontSize: 11, marginTop: 1 }}>● Online</div>
        </div>
        <button onClick={onLogout}
          style={{ background: '#111', border: '1px solid #1f1f1f', color: '#6B7280',
            padding: '7px 15px', borderRadius: 9, cursor: 'pointer', fontSize: 13 }}>
          Sign Out
        </button>
      </div>

      {showProf && (
        <ProfileModal user={me} onClose={() => setShowProf(false)}
          onSave={u => setMe(u)} />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   CHAT SCREEN
   ────────────────────────────────────────────────────────── */
function ChatScreen({ me, other: initOther, onBack }) {
  const [msgs,       setMsgs]       = useState([]);
  const [text,       setText]       = useState('');
  const [showEmoji,  setShowEmoji]  = useState(false);
  const [showVanish, setShowVanish] = useState(false);
  const [other,      setOther]      = useState(initOther);
  const inputRef = useRef();
  const bottomRef = useRef();

  const load = useCallback(() => {
    const fresh = DB.users.find(u => u.id === other.id);
    if (fresh) setOther(fresh);
    setMsgs(Msg.get(me.id, other.id));
  }, [me.id, other.id]);

  useEffect(() => {
    load(); Auth.ping(me.id);
    const iv = setInterval(() => { load(); Auth.ping(me.id); }, 3000);
    return () => clearInterval(iv);
  }, [load, me.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const send = () => {
    const t = text.trim(); if (!t) return;
    Msg.send(me.id, other.id, t);
    setText(''); setShowEmoji(false);
    inputRef.current?.blur();
    load();
  };

  const priv = Auth.priv(other.id);
  const on   = priv.online && Auth.isOnline(other.id);

  /* Group messages by date */
  const grouped = [];
  let lastD = null;
  msgs.forEach(m => {
    const d = fmtDate(m.at);
    if (d !== lastD) { grouped.push({ d: true, l: d, k: 'd' + d }); lastD = d; }
    grouped.push({ m, k: m.id });
  });

  const freshMe = DB.users.find(u => u.id === me.id) || me;

  return (
    <div className="screen">
      {/* Header */}
      <div className="chat-header">
        <button className="chat-back-btn" onClick={onBack}>←</button>
        <Avatar user={other} size={42} showOnline />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {other.name}
          </div>
          <div style={{ fontSize: 11, color: on ? '#22C55E' : '#555', marginTop: 1 }}>
            {on ? '● Online now' : priv.seen ? `Last seen ${Auth.lastSeen(other.id)}` : ''}
          </div>
        </div>
        <button onClick={() => setShowVanish(true)}
          className="icon-circle-btn" style={{ background: '#111', fontSize: 17 }}>
          👻
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {msgs.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: '#2a2a2a' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>Start chatting</div>
            <div style={{ fontSize: 13, marginTop: 5 }}>Say hi to {other.name}!</div>
          </div>
        )}

        {grouped.map(item => {
          if (item.d) return (
            <div key={item.k} className="date-separator">
              <span>{item.l}</span>
            </div>
          );

          const { m } = item;
          const mine = m.from === me.id;
          const u    = mine ? freshMe : other;

          return (
            <div key={item.k} className={`msg-row ${mine ? 'mine' : ''}`}>
              {!mine && <Avatar user={u} size={28} />}
              <div style={{ maxWidth: '74%' }}>
                {!mine && <div className="msg-sender-name">{u.name}</div>}
                <div className={`msg-bubble ${mine ? 'mine' : 'theirs'}`}>{m.text}</div>
                <div className={`msg-time ${mine ? 'mine' : 'theirs'}`}>{fmtTime(m.at)}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Emoji picker */}
      {showEmoji && (
        <div className="emoji-picker">
          {EMOJIS.map(e => (
            <button key={e} className="emoji-btn"
              onClick={() => { setText(t => t + e); inputRef.current?.focus(); }}>
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="chat-input-bar">
        <button className="icon-circle-btn"
          style={{ background: showEmoji ? '#7C3AED' : '#111' }}
          onClick={() => setShowEmoji(e => !e)}>
          😊
        </button>

        <textarea ref={inputRef} value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message…" rows={1}
          className="chat-textarea"
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 108) + 'px';
          }} />

        <button onClick={send} disabled={!text.trim()}
          className={`send-btn ${text.trim() ? 'active' : 'inactive'}`}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Vanish confirm */}
      {showVanish && (
        <div className="modal-overlay">
          <div className="vanish-modal fade-in">
            <div style={{ fontSize: 48, marginBottom: 12 }}>👻</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
              Vanish this chat?
            </div>
            <div style={{ color: '#555', fontSize: 13, marginBottom: 26, lineHeight: 1.6 }}>
              All messages with <span style={{ color: '#A78BFA' }}>{other.name}</span> will be permanently deleted for both of you.
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setShowVanish(false)}
                style={{ flex: 1, padding: 12, borderRadius: 11, border: '1px solid #2a2a2a',
                  background: 'transparent', color: '#aaa', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { Msg.vanish(me.id, other.id); setShowVanish(false); load(); }}
                style={{ flex: 1, padding: 12, borderRadius: 11, border: 'none',
                  background: '#EF4444', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                Vanish 🔥
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   HELPER UI COMPONENTS
   ────────────────────────────────────────────────────────── */
function Empty({ icon, text }) {
  return (
    <div className="empty-state">
      <div className="icon">{icon}</div>
      <div className="text">{text}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   ROOT APP
   ────────────────────────────────────────────────────────── */
function App() {
  const [user, setUser] = useState(null);
  const [chat, setChat] = useState(null);

  if (!user) return <AuthScreen onLogin={u => { setUser(u); setChat(null); }} />;
  if (chat)  return <ChatScreen me={user} other={chat} onBack={() => setChat(null)} />;
  return <UsersListScreen me={user} onChat={setChat} onLogout={() => { setUser(null); setChat(null); }} />;
}

/* ── Mount ── */
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
