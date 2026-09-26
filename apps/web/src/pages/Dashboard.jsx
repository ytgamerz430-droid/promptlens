import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { auth, credits, errMsg } from '../api/client.js';
import { useStore } from '../store.js';
import Logo from '../components/Logo.jsx';
import Button from '../components/Button.jsx';

const NAV = [
  { to: '/dashboard/studio', label: 'Prompt Studio', icon: 'M12 3l1.9 5.7L19.6 10l-5.7 1.9L12 17.6l-1.9-5.7L4.4 10l5.7-1.3L12 3z' },
  { to: '/dashboard/metadata', label: 'Stock Metadata', icon: 'M4 5h16v14H4z M4 19l5-5 4 4 3-3 4 4' },
  { to: '/dashboard/analysis', label: 'Analysis Lab', icon: 'M9 3h6M10 3v5l-5 9a2.4 2.4 0 002.1 3.6h9.8A2.4 2.4 0 0019 17l-5-9V3' },
  { to: '/dashboard/tracker', label: 'Tracker', icon: 'M21 21l-4.3-4.3M10 17a7 7 0 100-14 7 7 0 000 14z' },
  { to: '/dashboard/history', label: 'History', icon: 'M12 8v4l3 2M21 12a9 9 0 11-2.6-6.4M21 4v5h-5' },
  { to: '/dashboard/billing', label: 'Billing', icon: 'M3 7h18v10H3z M3 10h18 M7 15h4' },
  { to: '/dashboard/referral', label: 'Referral', icon: 'M8 12a4 4 0 108 0 4 4 0 00-8 0zM2 21c0-3.3 2.7-6 6-6h8c3.3 0 6 2.7 6 6' },
  { to: '/dashboard/tasks', label: 'Task Center', icon: 'M9 12l2 2 4-5M5 4h14v12H5z M5 20h14' },
  { to: '/dashboard/settings', label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2.1-1.2L14 3h-4l-.5 2.7a7 7 0 00-2.1 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 002.1 1.2L10 21h4l.5-2.7a7 7 0 002.1-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z' },
];

function NavIcon({ d }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const creditQ = useQuery({ queryKey: ['credits'], queryFn: credits.balance, retry: 1 });

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const doLogout = async () => {
    try {
      await auth.logout();
    } catch {
      /* stateless — discarding the token is enough */
    }
    logout();
    queryClient.clear();
    toast.info('Signed out.');
    navigate('/login');
  };

  const bal = creditQ.data;

  return (
    <div className="shell">
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-logo">
          <Link to="/dashboard" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => setMobileOpen(false)}>
            <Logo size={30} />
            {!collapsed && <span className="brand">PromptLens</span>}
          </Link>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? n.label : undefined}
            >
              <NavIcon d={n.icon} />
              <span className="nav-label">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button
            className="nav-item collapse-btn"
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <NavIcon d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
            <span className="nav-label">{collapsed ? '' : 'Collapse'}</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="row">
            <Button variant="ghost" size="sm" className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              ☰
            </Button>
          </div>
          <div className="row">
            <button
              className="credits-pill"
              onClick={() => navigate('/dashboard/billing')}
              title="View billing"
              aria-label={`Credits: ${bal?.balance ?? '—'}`}
            >
              {creditQ.isLoading ? '…' : `${bal?.balance ?? '—'} credits`}
            </button>
            <div className="user-menu" ref={menuRef}>
              <button
                className="user-btn"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
              >
                <span className="user-avatar" aria-hidden="true">
                  {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
                </span>
                <span className="small" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name || user?.email || 'Account'}
                </span>
              </button>
              {menuOpen && (
                <div className="menu-dropdown" role="menu">
                  <button className="menu-item" role="menuitem" onClick={() => { setMenuOpen(false); navigate('/dashboard/settings'); }}>
                    Settings
                  </button>
                  <button className="menu-item" role="menuitem" onClick={() => { toggleTheme(); }} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
                    {theme === 'dark' ? 'Light theme' : 'Dark theme'}
                  </button>
                  <button className="menu-item" role="menuitem" onClick={doLogout}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function creditsErrorMessage(e) {
  return errMsg(e);
}
