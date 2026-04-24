import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus, Trash2, Trophy, Zap, Users, Sparkles, X, Check, Flame, TrendingUp,
  Monitor, Settings, RotateCcw, Crown, Award, Medal, QrCode, ArrowLeft,
  ChevronRight, Beaker, Atom, Microscope, Vote, Activity, Radio, Download,
  AlertCircle, Info, Printer, LogOut, Mail, Loader2, ShieldCheck, Menu
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SUPABASE CLIENT
//
// Env vars (set these in Vercel: Project Settings → Environment Variables):
//   VITE_SUPABASE_URL       = https://uafgkqkpbuhefswhkqof.supabase.co
//   VITE_SUPABASE_ANON_KEY  = eyJ... (the anon public key, NOT service_role)
//
// For local dev, put the same two lines in a .env.local file at the project
// root. Make sure .env* is in your .gitignore so you don't commit keys.
//
// NOTE: the anon key is public by design — it ships in the frontend bundle.
// Row Level Security in Postgres is what actually protects your data.
// ============================================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[supabase] Missing env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    'in .env.local (local) or Vercel Project Settings (production).'
  );
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // handles the magic-link redirect
  },
});

// ============================================================================
// DEVICE-LEVEL VOTER ID
//
// We still use localStorage for ONE tiny thing: a random per-device ID that
// identifies "this browser" when voting anonymously. The database enforces
// one row per voter_id via a UNIQUE constraint, so even if someone clears
// localStorage and tries again, the DB will reject a duplicate… wait, no:
// clearing localStorage gives them a new voter_id. So this is "one vote per
// device state" — about as good as you get without forcing a real login.
// Good enough for a school science fair.
// ============================================================================
const VOTER_ID_KEY = 'scifair:voterId:v1';

function getOrCreateVoterId() {
  try {
    let v = localStorage.getItem(VOTER_ID_KEY);
    if (!v) {
      v = 'v_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(VOTER_ID_KEY, v);
    }
    return v;
  } catch {
    // Private-mode Safari or storage disabled — fall back to ephemeral ID.
    // User will get a fresh vote slot per refresh. Acceptable degradation.
    return 'v_ephemeral_' + Math.random().toString(36).slice(2, 10);
  }
}

// ============================================================================
// SUPABASE DATA HELPERS
// ============================================================================
const db = {
  async fetchProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) { console.warn('[fetchProjects]', error); return []; }
    // Map snake_case DB columns to the camelCase the UI already expects.
    return (data || []).map(r => ({
      id: r.id,
      title: r.title,
      student: r.student,
      grade: r.grade,
      emoji: r.emoji,
      color: r.color,
      createdAt: new Date(r.created_at).getTime(),
    }));
  },

  async fetchVotes() {
    const { data, error } = await supabase
      .from('votes')
      .select('id, project_id, voter_id, created_at')
      .order('created_at', { ascending: true });
    if (error) { console.warn('[fetchVotes]', error); return []; }
    return (data || []).map(r => ({
      id: r.id,
      projectId: r.project_id,
      voterId: r.voter_id,
      timestamp: new Date(r.created_at).getTime(),
    }));
  },

  async insertProject(p) {
    const { error } = await supabase.from('projects').insert({
      id: p.id,
      title: p.title,
      student: p.student,
      grade: p.grade,
      emoji: p.emoji,
      color: p.color,
    });
    if (error) { console.warn('[insertProject]', error); throw error; }
  },

  async deleteProject(id) {
    // CASCADE on the votes table FK will delete dependent votes automatically.
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) { console.warn('[deleteProject]', error); throw error; }
  },

  async insertVote(projectId, voterId) {
    const { error } = await supabase.from('votes').insert({
      project_id: projectId,
      voter_id: voterId,
    });
    if (error) {
      // 23505 is the Postgres unique-violation code — means they already voted.
      if (error.code === '23505') {
        throw new Error('ALREADY_VOTED');
      }
      console.warn('[insertVote]', error);
      throw error;
    }
  },

  async resetAllProjects() {
    // Deleting all projects cascades to delete all votes.
    const { error } = await supabase.from('projects').delete().neq('id', '__never__');
    if (error) { console.warn('[resetAllProjects]', error); throw error; }
  },

  async resetMyVote(voterId) {
    const { error } = await supabase.from('votes').delete().eq('voter_id', voterId);
    if (error) { console.warn('[resetMyVote]', error); throw error; }
  },
};

// ============================================================================
// CONSTANTS
// ============================================================================
const ACCENT_COLORS = [
  { name: 'lime',    hex: '#c8ff2e', soft: 'rgba(200,255,46,0.14)',  glow: 'rgba(200,255,46,0.45)' },
  { name: 'cyan',    hex: '#5eeaff', soft: 'rgba(94,234,255,0.14)',  glow: 'rgba(94,234,255,0.45)' },
  { name: 'magenta', hex: '#ff5eb8', soft: 'rgba(255,94,184,0.14)',  glow: 'rgba(255,94,184,0.45)' },
  { name: 'amber',   hex: '#ffc857', soft: 'rgba(255,200,87,0.14)',  glow: 'rgba(255,200,87,0.45)' },
  { name: 'violet',  hex: '#b196ff', soft: 'rgba(177,150,255,0.14)', glow: 'rgba(177,150,255,0.45)' },
  { name: 'coral',   hex: '#ff7a6b', soft: 'rgba(255,122,107,0.14)', glow: 'rgba(255,122,107,0.45)' },
];

const EMOJI_POOL = ['🧪','🔬','⚗️','🧬','🪐','🌱','⚡','🔭','🧲','🦾','🤖','🌋','🌊','🧠','💡','🔋','🌡️','🛰️','🦠','🌈'];

// ============================================================================
// UTILS
// ============================================================================
const genId = (prefix) => prefix + '_' + Math.random().toString(36).slice(2, 9);

const qrUrl = (data, size = 240) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&color=f5f2e8&bgcolor=0a0a14&margin=12&qzone=2&format=png`;

const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};

const colorOf = (name) => ACCENT_COLORS.find(c => c.name === name) || ACCENT_COLORS[0];

// ============================================================================
// FONT LOADER
// ============================================================================
function useFonts() {
  useEffect(() => {
    const links = [
      'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&display=swap',
      'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap',
      'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap',
    ];
    const els = links.map(href => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      document.head.appendChild(l);
      return l;
    });
    return () => els.forEach(e => e.remove());
  }, []);
}

// ============================================================================
// ORBITING ELECTRONS
// ============================================================================
function OrbitingElectrons({ className = '' }) {
  return (
    <div className={`absolute pointer-events-none ${className}`}>
      {/* Orbit rings */}
      <div className="absolute w-[240px] h-[240px] rounded-full border border-[#c8ff2e]/20 transform -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2" />
      <div className="absolute w-[360px] h-[360px] rounded-full border border-[#5eeaff]/15 transform -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2" />
      <div className="absolute w-[480px] h-[480px] rounded-full border border-[#ff5eb8]/10 transform -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2" />
      
      {/* Orbiting electrons */}
      {[0, 1, 2].map((i) => (
        <div
          key={`e${i}`}
          className="absolute w-3 h-3 rounded-full"
          style={{
            background: i % 2 === 0 ? '#c8ff2e' : '#5eeaff',
            boxShadow: i % 2 === 0 ? '0 0 12px #c8ff2e' : '0 0 12px #5eeaff',
            animation: `orbit${i + 1} ${20 + i * 4}s linear infinite`,
            transformOrigin: '120px 0',
          }}
        />
      ))}
      
      <style>{`
        @keyframes orbit1 {
          0% { transform: rotate(0deg) translateX(120px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(120px) rotate(-360deg); }
        }
        @keyframes orbit2 {
          0% { transform: rotate(120deg) translateX(180px) rotate(0deg); }
          100% { transform: rotate(480deg) translateX(180px) rotate(-360deg); }
        }
        @keyframes orbit3 {
          0% { transform: rotate(240deg) translateX(240px) rotate(0deg); }
          100% { transform: rotate(600deg) translateX(240px) rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// AMBIENT BACKGROUND
// ============================================================================
function AmbientBG() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0" style={{ background: '#07070c' }} />
      {/* gradient mesh blobs */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, #5eeaff 0%, transparent 70%)', animation: 'drift1 22s ease-in-out infinite' }} />
      <div className="absolute top-1/3 -right-40 w-[700px] h-[700px] rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #ff5eb8 0%, transparent 70%)', animation: 'drift2 28s ease-in-out infinite' }} />
      <div className="absolute -bottom-40 left-1/4 w-[650px] h-[650px] rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #c8ff2e 0%, transparent 70%)', animation: 'drift3 25s ease-in-out infinite' }} />
      {/* grain */}
      <div className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      <style>{`
        @keyframes drift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(80px, 60px) scale(1.1); } }
        @keyframes drift2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-60px, 40px) scale(1.15); } }
        @keyframes drift3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px, -80px) scale(1.08); } }
      `}</style>
    </div>
  );
}

// ============================================================================
// NAV
// ============================================================================
function Nav({ view, setView, totalVotes }) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const items = [
    { id: 'display', label: 'Display', icon: Monitor },
    { id: 'vote',    label: 'Vote',    icon: Vote },
    { id: 'qr',      label: 'QR Codes', icon: QrCode },
    { id: 'admin',   label: 'Admin',   icon: Settings },
  ];
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 backdrop-blur-xl bg-black/40 border-b border-white/5">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="relative w-6 h-6 sm:w-8 sm:h-8 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#c8ff2e,#5eeaff)' }}>
            <Atom size={16} className="sm:hidden text-black" strokeWidth={2.5} />
            <Atom size={18} className="hidden sm:block text-black" strokeWidth={2.5} />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 16, letterSpacing: '-0.02em' }} className="text-white">Scifair Live</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8 }} className="text-white/40 tracking-wider uppercase">voting</span>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="sm:hidden text-white/60 hover:text-white"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Desktop Nav */}
        <div className="hidden sm:flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-full text-xs md:text-sm transition-all ${
                view === id
                  ? 'bg-white text-black font-semibold'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              style={{ fontFamily: 'Inter Tight, sans-serif' }}
            >
              <Icon size={14} />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Vote Counter */}
        <div className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full bg-white/5 border border-white/10 flex-shrink-0">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-[#c8ff2e]" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#c8ff2e] animate-ping" />
          </div>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] sm:text-xs text-white/70">
            {totalVotes.toString().padStart(3, '0')}
          </span>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-black/80 border-t border-white/10 p-3 space-y-2">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setView(id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all ${
                view === id
                  ? 'bg-white text-black font-semibold'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              style={{ fontFamily: 'Inter Tight, sans-serif' }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

// ============================================================================
// DISPLAY VIEW — big screen leaderboard
// ============================================================================
function DisplayView({ projects, votes, voteCount, sortedProjects, recentVotes, tightRaces, lastVoteFlash }) {
  const topVotes = sortedProjects[0] ? voteCount[sortedProjects[0].id] || 0 : 0;
  const maxBar = Math.max(topVotes, 1);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 10000);
    return () => clearInterval(t);
  }, []);

  if (projects.length === 0) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="text-center max-w-lg">
          <div className="inline-flex p-4 rounded-2xl mb-6" style={{ background: 'rgba(200,255,46,0.08)', border: '1px solid rgba(200,255,46,0.2)' }}>
            <Microscope size={48} style={{ color: '#c8ff2e' }} />
          </div>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 300 }} className="text-5xl text-white mb-3 tracking-tight">
            No projects yet.
          </h1>
          <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-white/50 text-lg">
            Head to <span className="text-white">Admin</span> to add science fair projects. Then print QR codes and watch the votes roll in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header with BISK Logo */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 sm:gap-8 mb-8 sm:mb-12">
          <div className="flex items-end gap-3 sm:gap-8 flex-wrap">
            {/* BISK Logo - Responsive */}
            <div className="relative flex-shrink-0">
              <div className="w-20 sm:w-28 md:w-[140px] h-20 sm:h-28 md:h-[140px] rounded-2xl sm:rounded-3xl p-2 sm:p-4 flex items-center justify-center"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(200,255,46,0.1), rgba(94,234,255,0.1))',
                  border: '2px solid rgba(200,255,46,0.3)',
                  boxShadow: '0 0 40px rgba(200,255,46,0.2)'
                }}>
                <img 
                  src="https://bisk.edu.krd/wp-content/uploads/2024/07/BISK-BADGE-231x300.png"
                  alt="BISK Logo"
                  className="w-14 sm:w-20 md:w-24 h-14 sm:h-20 md:h-24 object-contain drop-shadow-lg"
                  style={{ animation: 'logoFloat 4s ease-in-out infinite' }}
                />
              </div>
              <OrbitingElectrons className="hidden sm:block w-32 sm:w-48 md:w-[220px] h-32 sm:h-48 md:h-[220px] -top-8 sm:-top-10 -left-8 sm:-left-10" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[#c8ff2e]">
                  ◆ Live
                </span>
              </div>
              <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 300, letterSpacing: '-0.04em' }} className="text-white leading-[0.9]">
                <span className="block text-2xl sm:text-4xl md:text-5xl lg:text-7xl">
                  <span style={{ color: '#ff4444', display: 'inline-block' }}>B</span>
                  <span 
                    style={{ 
                      color: '#1a3a70', 
                      display: 'inline-block', 
                      animation: 'parabolaPath 8s ease-in-out infinite',
                      position: 'relative',
                      textShadow: '0 0 10px rgba(26,58,112,0.5)'
                    }}
                  >
                    1
                    <span 
                      style={{
                        position: 'absolute',
                        bottom: '-8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '8px',
                        height: '12px',
                        background: 'linear-gradient(to bottom, #ff9933, #ff6600)',
                        borderRadius: '4px 4px 0 0',
                        animation: 'flameGlow 0.4s ease-in-out infinite',
                        boxShadow: '0 0 20px #ff6600, 0 0 40px rgba(255,102,0,0.8)',
                        filter: 'drop-shadow(0 0 10px #ff9933)',
                        fontSize: '0.7em'
                      }}
                    />
                  </span>
                  <span style={{ color: '#1a3a70', display: 'inline-block' }}>5</span>
                  <span style={{ color: '#ff4444', display: 'inline-block' }}>K</span>
                </span>
                <span className="block text-lg sm:text-2xl md:text-3xl lg:text-4xl text-white">Science Fair</span>
              </h1>
            </div>
          </div>
          <div className="hidden lg:flex flex-col items-end gap-2 flex-shrink-0">
            <StatPill label="Projects" value={projects.length} />
            <StatPill label="Votes" value={votes.length} highlight />
            <StatPill label="Leader" value={sortedProjects[0]?.title.slice(0, 18) || '—'} mono={false} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_380px] gap-4 sm:gap-6 md:gap-8">
          {/* Leaderboard */}
          <div className="space-y-2 sm:space-y-3 md:space-y-4">
            {sortedProjects.map((p, idx) => {
              const count = voteCount[p.id] || 0;
              const pct = (count / maxBar) * 100;
              const c = colorOf(p.color);
              const flashing = lastVoteFlash === p.id;
              const isLeader = idx === 0 && count > 0;
              
              return (
                <div
                  key={p.id}
                  className="relative rounded-2xl overflow-hidden transition-all duration-700"
                  style={{
                    background: isLeader 
                      ? 'linear-gradient(90deg, rgba(255,255,255,0.025) 0%, rgba(255,122,107,0.15) 100%)'
                      : flashing ? c.soft : 'rgba(255,255,255,0.025)',
                    border: isLeader 
                      ? '2px solid #ff4444'
                      : `2px solid ${flashing ? c.hex : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: isLeader
                      ? `0 0 60px rgba(255,68,68,0.6), inset 0 0 30px rgba(255,122,107,0.3), inset 40px 0 60px rgba(255,68,68,0.2)`
                      : flashing 
                      ? `0 0 60px ${c.glow}, inset 0 0 40px ${c.glow}` 
                      : 'none',
                    transform: flashing ? 'scale(1.008)' : 'scale(1)',
                    animation: isLeader ? `flameWaveLeft 3s ease-in-out infinite` : `slideIn${idx} 0.6s ease-out ${idx * 0.08}s both`,
                  }}
                >
                  {/* Flame particles from right for leader */}
                  {isLeader && (
                    <>
                      <div
                        style={{
                          position: 'absolute',
                          top: '0',
                          right: '0',
                          width: '100%',
                          height: '100%',
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,68,68,0.3) 50%, transparent 100%)',
                          animation: 'flamesInFromRight 2s ease-in infinite',
                          pointerEvents: 'none',
                          borderRadius: '2xl'
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          right: '0',
                          width: '80px',
                          height: '40%',
                          background: 'radial-gradient(ellipse at right center, rgba(255,122,107,0.6), transparent)',
                          animation: 'flamesWaveRight 2.5s ease-in-out infinite 0.3s',
                          pointerEvents: 'none',
                          transform: 'translateY(-50%)'
                        }}
                      />
                    </>
                  )}
                  {/* progress bar fill */}
                  <div className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out"
                    style={{
                      width: `${pct}%`,
                      background: isLeader
                        ? `linear-gradient(90deg, rgba(255,68,68,0.6) 0%, rgba(255,122,107,0.3) 100%)`
                        : `linear-gradient(90deg, ${c.hex}44 0%, ${c.hex}12 100%)`,
                      borderRight: isLeader ? `2px solid #ff6666` : `2px solid ${c.hex}`,
                    }} />

                  <div className="relative flex items-center gap-2 sm:gap-3 md:gap-4 lg:gap-5 p-3 sm:p-4 md:p-5 lg:p-6">
                    {/* Rank with podium styling - hidden on small mobile */}
                    <div className="hidden xs:flex flex-shrink-0 w-12 sm:w-14 md:w-16 h-16 sm:h-18 md:h-20 items-center justify-center relative">
                      <RankBadge rank={idx + 1} isLeader={isLeader} color={c} />
                      {isLeader && (
                        <div className="absolute -top-4 sm:-top-5 md:-top-6 left-1/2 transform -translate-x-1/2 text-lg sm:text-xl md:text-2xl animate-bounce">
                          🏆
                        </div>
                      )}
                    </div>

                    {/* Emoji + info */}
                    <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
                      <div className="text-3xl sm:text-4xl md:text-5xl flex-shrink-0 w-10 sm:w-12 md:w-14 lg:w-16 h-10 sm:h-12 md:h-14 lg:h-16 flex items-center justify-center rounded-lg sm:rounded-xl"
                        style={{ 
                          background: c.soft, 
                          border: `2px solid ${c.hex}`,
                          boxShadow: `0 0 20px ${c.glow}`,
                          animation: isLeader ? 'pulse 2s ease-in-out infinite' : 'none'
                        }}>
                        {p.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500, letterSpacing: '-0.01em' }} 
                          className="text-sm sm:text-base md:text-xl lg:text-2xl xl:text-3xl text-white truncate leading-tight">
                          {p.title}
                        </h3>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] sm:text-xs text-white/50 mt-0.5 sm:mt-1 md:mt-2 hidden sm:flex items-center gap-2">
                          <span className="truncate">{p.student}</span>
                          <span className="w-1 h-1 rounded-full bg-white/30 flex-shrink-0" />
                          <span className="flex-shrink-0">Grade {p.grade}</span>
                        </div>
                      </div>
                    </div>

                    {/* Count with dynamic scaling */}
                    <div className="flex-shrink-0 text-right">
                      <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 300, color: c.hex, letterSpacing: '-0.04em' }}
                        className={`text-2xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl leading-none transition-transform duration-300 ${flashing ? 'scale-125 animate-ping' : 'scale-100'}`}>
                        {count}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[8px] sm:text-[10px] uppercase tracking-widest text-white/40 mt-0.5 sm:mt-1">
                        {count === 1 ? 'vote' : 'votes'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Side panel */}
          <div className="space-y-6">
            <TightRacesPanel races={tightRaces} />
            <RecentVotesPanel votes={recentVotes} projects={projects} tick={tick} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value, highlight, mono = true }) {
  return (
    <div className="flex items-baseline gap-3 px-4 py-2 rounded-lg"
      style={{ background: highlight ? 'rgba(200,255,46,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${highlight ? 'rgba(200,255,46,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] uppercase tracking-widest text-white/50">{label}</span>
      <span style={{ fontFamily: mono ? 'JetBrains Mono, monospace' : 'Fraunces, serif', color: highlight ? '#c8ff2e' : 'white' }} className="text-lg font-semibold">{value}</span>
    </div>
  );
}

function RankBadge({ rank, isLeader, color }) {
  if (rank === 1 && isLeader) {
    return (
      <div className="relative flex items-center justify-center w-12 h-12 rounded-xl" style={{ background: 'linear-gradient(135deg,#ffd700,#ff9500)' }}>
        <Crown size={20} className="text-black" strokeWidth={2.5} />
      </div>
    );
  }
  if (rank === 2) return <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/10"><Award size={18} className="text-white/80" /></div>;
  if (rank === 3) return <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/5"><Medal size={18} className="text-white/60" /></div>;
  return (
    <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 300 }} className="text-5xl text-white/20 text-center leading-none">
      {rank}
    </div>
  );
}

function TightRacesPanel({ races }) {
  return (
    <div className="rounded-xl sm:rounded-2xl p-4 sm:p-5 border-2 border-[#ff5eb8]" style={{ 
      background: 'linear-gradient(135deg, rgba(255,94,184,0.15), rgba(255,122,107,0.1))',
      boxShadow: '0 0 30px rgba(255,94,184,0.3), inset 0 0 20px rgba(255,94,184,0.1)'
    }}>
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Flame size={14} className="sm:size-18" style={{ color: '#ff5eb8', animation: 'flameBurn 0.8s ease-in-out infinite' }} />
        <h3 style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[9px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#ff5eb8]">
          🔥 Tight Races
        </h3>
        <Flame size={12} className="sm:size-14" style={{ color: '#ff7a6b', animation: 'flameBurn 0.6s ease-in-out infinite 0.2s' }} />
      </div>
      {races.length === 0 ? (
        <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-xs sm:text-sm text-white/40">
          No close competitions yet. Let the votes flow.
        </p>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {races.slice(0, 3).map(([a, b, diff], i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 sm:p-3 rounded-lg transition-all duration-300"
              style={{
                background: 'rgba(255,94,184,0.1)',
                border: '1px solid rgba(255,94,184,0.3)',
                boxShadow: '0 0 15px rgba(255,94,184,0.2)',
                animation: `raceFlare 2s ease-in-out infinite ${i * 0.3}s`
              }}>
              <div className="flex-1 min-w-0">
                <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-white text-xs sm:text-sm truncate">
                  {a.emoji} <span style={{ color: '#ff5eb8' }}>{a.title}</span>
                </div>
                <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-white/60 text-xs sm:text-sm truncate mt-0.5">
                  {b.emoji} {b.title}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div style={{ fontFamily: 'JetBrains Mono, monospace', color: '#ff5eb8' }} 
                  className={`text-[10px] sm:text-xs font-bold transition-transform ${diff === 0 ? 'animate-pulse' : ''}`}
                  style={{ animation: `diffFlare ${1 + diff * 0.2}s ease-in-out infinite` }}>
                  {diff === 0 ? '🔥 TIED 🔥' : `+${diff}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`
        @keyframes flameBurn {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: 1; }
          50% { transform: scaleY(1.2) scaleX(0.95); opacity: 0.8; }
        }
        @keyframes raceFlare {
          0%, 100% { box-shadow: 0 0 15px rgba(255,94,184,0.2); }
          50% { box-shadow: 0 0 25px rgba(255,94,184,0.5), inset 0 0 15px rgba(255,122,107,0.2); }
        }
        @keyframes diffFlare {
          0%, 100% { transform: scale(1); color: #ff5eb8; }
          50% { transform: scale(1.1); color: #ff7a6b; }
        }
      `}</style>
    </div>
  );
}

function RecentVotesPanel({ votes, projects, tick }) {
  return (
    <div className="rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/10" style={{ background: 'rgba(94,234,255,0.04)' }}>
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Radio size={14} className="sm:size-16" style={{ color: '#5eeaff' }} />
        <h3 style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[9px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#5eeaff]">
          Vote Stream
        </h3>
        <div className="flex-1" />
        <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-[#5eeaff] animate-pulse" />
      </div>
      {votes.length === 0 ? (
        <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-xs sm:text-sm text-white/40">
          Waiting for the first vote...
        </p>
      ) : (
        <div className="space-y-1.5 sm:space-y-2 max-h-[280px] sm:max-h-[380px] overflow-y-auto pr-1">
          {votes.map((v, i) => {
            const proj = projects.find(p => p.id === v.projectId);
            if (!proj) return null;
            const c = colorOf(proj.color);
            return (
              <div key={v.timestamp + '-' + i} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)', animation: i === 0 ? 'slideIn 0.4s ease-out' : 'none' }}>
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full flex-shrink-0" style={{ background: c.hex, boxShadow: `0 0 8px ${c.glow}` }} />
                <div className="text-base sm:text-lg">{proj.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-white text-xs sm:text-sm truncate">{proj.title}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[9px] sm:text-[10px] text-white/40 mt-0.5">{timeAgo(v.timestamp)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes slideIn { from { opacity:0; transform: translateX(-8px);} to { opacity:1; transform: translateX(0);} }`}</style>
    </div>
  );
}

// ============================================================================
// VOTE VIEW
// ============================================================================
function VoteView({ projects, voteCount, hasVoted, myVote, castVote, resetMyVote }) {
  const [pending, setPending] = useState(null);
  const [justVoted, setJustVoted] = useState(false);

  const confirmVote = async () => {
    if (!pending) return;
    await castVote(pending.id);
    setJustVoted(true);
    setPending(null);
    setTimeout(() => setJustVoted(false), 2500);
  };

  if (projects.length === 0) {
    return (
      <div className="min-h-screen pt-20 sm:pt-24 flex items-center justify-center px-3 sm:px-6">
        <div className="text-center">
          <Beaker size={40} className="sm:size-48 text-white/30 mx-auto mb-3 sm:mb-4" />
          <p style={{ fontFamily: 'Fraunces, serif' }} className="text-sm sm:text-xl md:text-2xl text-white/60">No projects to vote on yet.</p>
        </div>
      </div>
    );
  }

  if (hasVoted) {
    const votedProject = projects.find(p => p.id === myVote?.projectId);
    const c = votedProject ? colorOf(votedProject.color) : ACCENT_COLORS[0];
    return (
      <div className="min-h-screen pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl sm:rounded-3xl p-6 sm:p-10 text-center relative overflow-hidden"
            style={{ background: c.soft, border: `1px solid ${c.hex}44` }}>
            <div className="absolute inset-0 opacity-30 blur-3xl"
              style={{ background: `radial-gradient(circle at 50% 30%, ${c.hex}, transparent 70%)` }} />
            <div className="relative">
              <div className="inline-flex items-center justify-center w-12 sm:w-16 h-12 sm:h-16 rounded-full mb-4 sm:mb-6"
                style={{ background: c.hex }}>
                <Check size={24} className="sm:size-32 text-black" strokeWidth={3} />
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-2 sm:mb-3" style={{ color: c.hex }}>
                Vote recorded
              </div>
              <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 300 }} className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white mb-3 sm:mb-4 leading-tight">
                Thank you for voting for
              </h1>
              <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">{votedProject?.emoji}</div>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500, color: c.hex }} className="text-xl sm:text-2xl md:text-3xl mb-1">
                {votedProject?.title}
              </h2>
              <p style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs sm:text-sm text-white/50">
                by {votedProject?.student} · Grade {votedProject?.grade}
              </p>
              <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-xs sm:text-sm text-white/50 mt-6 sm:mt-8 mb-4 sm:mb-6 max-w-md mx-auto">
                Your vote has been locked in. One vote per attendee — you're done. Check the Display to see live standings.
              </p>
              <button onClick={resetMyVote}
                className="text-[10px] sm:text-xs text-white/30 hover:text-white/60 underline transition"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                [demo] reset my vote
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[#c8ff2e] mb-2">
            ◆ Cast your vote
          </div>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 300, letterSpacing: '-0.03em' }} className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-none">
            Pick <span className="italic" style={{ color: '#c8ff2e' }}>one</span> favorite.
          </h1>
          <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-xs sm:text-sm text-white/50 mt-2 sm:mt-3 max-w-xl">
            You get a single vote. Choose the project that impressed you most. Tap a card below to vote.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {projects.map((p) => {
            const c = colorOf(p.color);
            const count = voteCount[p.id] || 0;
            return (
              <button
                key={p.id}
                onClick={() => setPending(p)}
                className="group relative rounded-lg sm:rounded-2xl p-4 sm:p-6 text-left transition-all duration-300 hover:scale-[1.02] overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = c.hex + '66';
                  e.currentTarget.style.background = c.soft;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
              >
                <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                  style={{ background: `radial-gradient(circle, ${c.hex}, transparent)` }} />
                <div className="relative">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="text-3xl sm:text-4xl md:text-5xl">{p.emoji}</div>
                    <div className="text-right">
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', color: c.hex }} className="text-[10px] sm:text-xs tracking-widest uppercase">
                        {count} {count === 1 ? 'vote' : 'votes'}
                      </div>
                    </div>
                  </div>
                  <h3 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500, letterSpacing: '-0.01em' }} className="text-base sm:text-lg md:text-2xl text-white mb-1 sm:mb-2 leading-tight">
                    {p.title}
                  </h3>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] sm:text-xs text-white/50 flex items-center gap-2">
                    <span className="truncate">{p.student}</span>
                    <span className="w-1 h-1 rounded-full bg-white/30 flex-shrink-0" />
                    <span className="flex-shrink-0">Grade {p.grade}</span>
                  </div>
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/5 flex items-center justify-between">
                    <span style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-xs sm:text-sm text-white/60 group-hover:text-white transition">
                      Tap to vote
                    </span>
                    <ChevronRight size={14} className="sm:size-16 text-white/30 group-hover:text-white transition group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Confirm modal */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm" onClick={() => setPending(null)}>
          <div className="relative rounded-xl sm:rounded-2xl p-6 sm:p-8 max-w-md w-full" style={{ background: '#0f0f1a', border: `1px solid ${colorOf(pending.color).hex}66` }}
            onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPending(null)} className="absolute top-4 right-4 text-white/40 hover:text-white">
              <X size={18} />
            </button>
            <div className="text-center">
              <div className="text-6xl mb-4">{pending.emoji}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs uppercase tracking-[0.3em] text-white/50 mb-2">
                Confirm your vote
              </div>
              <h3 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-2xl text-white mb-1">{pending.title}</h3>
              <p style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs text-white/50 mb-6">
                {pending.student} · Grade {pending.grade}
              </p>
              <div className="p-3 rounded-lg mb-6 flex items-start gap-2 text-left" style={{ background: 'rgba(255,200,87,0.08)', border: '1px solid rgba(255,200,87,0.2)' }}>
                <AlertCircle size={14} className="text-[#ffc857] flex-shrink-0 mt-0.5" />
                <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-xs text-white/70">
                  You only get <strong className="text-[#ffc857]">one vote</strong>. Once cast, it's locked on this device.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPending(null)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition"
                  style={{ fontFamily: 'Inter Tight, sans-serif', fontWeight: 500 }}>
                  Cancel
                </button>
                <button onClick={confirmVote}
                  className="flex-1 py-3 rounded-xl text-black font-semibold transition hover:scale-[1.02]"
                  style={{ background: colorOf(pending.color).hex, fontFamily: 'Inter Tight, sans-serif', fontWeight: 600 }}>
                  Lock in vote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* flash */}
      {justVoted && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="text-[240px]" style={{ animation: 'flashPop 2s ease-out forwards' }}>🎉</div>
          <style>{`@keyframes flashPop { 0% { opacity:0; transform:scale(0.5);} 20%{opacity:1;transform:scale(1.2);} 80%{opacity:1;transform:scale(1);} 100%{opacity:0;transform:scale(1.1);} }`}</style>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// QR CODES VIEW
// ============================================================================
function QRView({ projects }) {
  const baseUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : 'https://yourdomain.com/vote';
  const voteUrl = baseUrl;

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 sm:gap-4 flex-wrap">
          <div className="flex-1">
            <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[#5eeaff] mb-1 sm:mb-2">
              ◆ Print & place
            </div>
            <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 300, letterSpacing: '-0.03em' }} className="text-3xl sm:text-4xl md:text-5xl text-white leading-none">
              Scan-to-vote QR codes
            </h1>
            <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-xs sm:text-sm text-white/50 mt-2 sm:mt-3 max-w-xl">
              Print these and place one at each project's poster. Attendees scan to land on the voting page.
            </p>
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-white text-black font-medium hover:scale-105 transition text-sm flex-shrink-0"
            style={{ fontFamily: 'Inter Tight, sans-serif' }}>
            <Printer size={14} className="sm:size-16" /> Print
          </button>
        </div>

        <div className="rounded-lg sm:rounded-xl p-3 sm:p-4 mb-6 sm:mb-8 flex items-start gap-2 sm:gap-3" style={{ background: 'rgba(255,200,87,0.06)', border: '1px solid rgba(255,200,87,0.2)' }}>
          <Info size={14} className="sm:size-16 text-[#ffc857] flex-shrink-0 mt-0.5" />
          <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-[10px] sm:text-sm text-white/70">
            <strong className="text-[#ffc857]">Demo note:</strong> these QRs encode this artifact's URL, which only works inside Claude. For a real science fair, deploy the app to a public URL (Vercel/Netlify/etc.) and regenerate codes — the code here will do that automatically off <code className="text-white/90" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7em' }}>window.location</code>.
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-12 sm:py-20">
            <QrCode size={32} className="sm:size-48 text-white/20 mx-auto mb-3 sm:mb-4" />
            <p style={{ fontFamily: 'Fraunces, serif' }} className="text-sm sm:text-xl text-white/50">Add projects to generate QR codes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 print:grid-cols-2">
            {projects.map((p) => {
              const c = colorOf(p.color);
              return (
                <div key={p.id} className="rounded-lg sm:rounded-2xl p-4 sm:p-6 break-inside-avoid"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.hex}33` }}>
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="text-2xl sm:text-3xl">{p.emoji}</div>
                    <div className="w-2 h-2 rounded-full" style={{ background: c.hex }} />
                  </div>
                  <h3 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-base sm:text-xl text-white leading-tight mb-0.5 sm:mb-1 line-clamp-2">
                    {p.title}
                  </h3>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] sm:text-xs text-white/50 mb-3 sm:mb-4 truncate">
                    {p.student} · Grade {p.grade}
                  </p>
                  <div className="rounded-lg sm:rounded-xl p-2 sm:p-3 flex items-center justify-center" style={{ background: '#0a0a14', border: `1px solid ${c.hex}22` }}>
                    <img src={qrUrl(voteUrl + '?p=' + p.id, 220)} alt="QR code" className="w-full h-auto max-w-[160px] sm:max-w-[200px]" />
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/40 text-center mt-2 sm:mt-3">
                    Scan to vote
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ADMIN VIEW
// ============================================================================
function AdminView({ projects, votes, voteCount, addProject, deleteProject, resetAll, session, signIn, signOut, authError, authPending, authEmailSent }) {
  // Auth gate: if not logged in, show only the magic-link login form.
  if (!session) {
    return <AdminLogin signIn={signIn} authError={authError} authPending={authPending} authEmailSent={authEmailSent} />;
  }

  const adminEmail = session.user?.email || 'unknown';

  const [form, setForm] = useState({
    title: '', student: '', grade: '', emoji: EMOJI_POOL[0], color: ACCENT_COLORS[0].name,
  });
  const [error, setError] = useState('');

  const submit = async () => {
    if (!form.title.trim() || !form.student.trim() || !form.grade.trim()) {
      setError('Fill in all fields.');
      return;
    }
    setError('');
    await addProject(form);
    setForm({
      title: '', student: '', grade: '',
      emoji: EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)],
      color: ACCENT_COLORS[(projects.length + 1) % ACCENT_COLORS.length].name,
    });
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 sm:gap-4 flex-wrap">
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[#ff5eb8] mb-1 sm:mb-2">
              ◆ Event console
            </div>
            <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 300, letterSpacing: '-0.03em' }} className="text-3xl sm:text-4xl md:text-5xl text-white leading-none">
              Manage projects.
            </h1>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 px-2 sm:px-3 py-2 rounded-full bg-white/5 border border-white/10">
            <ShieldCheck size={12} className="sm:size-14 text-[#c8ff2e]" />
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] sm:text-xs text-white/70">{adminEmail}</span>
            <button onClick={signOut}
              className="mt-2 sm:mt-0 sm:ml-2 flex items-center gap-1 text-[10px] sm:text-xs text-white/50 hover:text-[#ff7a6b] transition"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              <LogOut size={10} className="sm:size-12" /> Sign out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[420px_1fr] gap-4 sm:gap-6">
          {/* Add form */}
          <div className="rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-lg sm:text-2xl text-white mb-3 sm:mb-5 flex items-center gap-2">
              <Plus size={16} className="sm:size-20" /> Add project
            </h2>
            <div className="space-y-3 sm:space-y-4">
              <Field label="Project title" value={form.title} onChange={v => setForm({ ...form, title: v })} placeholder="e.g. Solar-Powered Water Purifier" />
              <Field label="Student name" value={form.student} onChange={v => setForm({ ...form, student: v })} placeholder="e.g. Maya Kapoor" />
              <Field label="Grade" value={form.grade} onChange={v => setForm({ ...form, grade: v })} placeholder="e.g. 8" />

              <div>
                <label style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/50 block mb-1.5 sm:mb-2">Icon</label>
                <div className="flex flex-wrap gap-1 p-2 rounded-lg bg-black/30 border border-white/5">
                  {EMOJI_POOL.map(e => (
                    <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                      className={`w-6 sm:w-8 h-6 sm:h-8 rounded flex items-center justify-center text-sm sm:text-lg transition ${
                        form.emoji === e ? 'bg-white/20 scale-110' : 'hover:bg-white/10'
                      }`}>{e}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/50 block mb-1.5 sm:mb-2">Accent color</label>
                <div className="flex gap-2 flex-wrap">
                  {ACCENT_COLORS.map(c => (
                    <button key={c.name} onClick={() => setForm({ ...form, color: c.name })}
                      className={`w-7 sm:w-9 h-7 sm:h-9 rounded-lg transition ${form.color === c.name ? 'ring-2 ring-white scale-110' : ''}`}
                      style={{ background: c.hex }} />
                  ))}
                </div>
              </div>

              {error && <p style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs text-[#ff7a6b]">{error}</p>}

              <button onClick={submit}
                className="w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-[#c8ff2e] text-black font-semibold hover:scale-[1.01] transition text-sm sm:text-base"
                style={{ fontFamily: 'Inter Tight, sans-serif' }}>
                Add to fair
              </button>
            </div>
          </div>

          {/* List */}
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
              <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-lg sm:text-2xl text-white">
                Active projects
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs sm:text-sm text-white/40 ml-2 sm:ml-3">{projects.length}</span>
              </h2>
              {(projects.length > 0 || votes.length > 0) && (
                <button onClick={resetAll} className="flex items-center gap-1 text-[10px] sm:text-xs text-white/50 hover:text-[#ff7a6b] transition px-2 sm:px-3 py-1.5 rounded-full border border-white/10 flex-shrink-0"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  <RotateCcw size={10} className="sm:size-12" /> Reset event
                </button>
              )}
            </div>

            {projects.length === 0 ? (
              <div className="rounded-xl sm:rounded-2xl p-6 sm:p-12 text-center border border-dashed border-white/10">
                <p style={{ fontFamily: 'Fraunces, serif' }} className="text-white/40 text-sm sm:text-lg italic">No projects added yet.</p>
              </div>
            ) : (
              <div className="space-y-1 sm:space-y-2">
                {projects.map(p => {
                  const c = colorOf(p.color);
                  const count = voteCount[p.id] || 0;
                  return (
                    <div key={p.id} className="rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-4"
                      style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${c.hex}22` }}>
                      <div className="text-xl sm:text-2xl flex-shrink-0">{p.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-sm sm:text-base text-white truncate">{p.title}</div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] sm:text-xs text-white/50 truncate">
                          {p.student} · Grade {p.grade}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', color: c.hex }} className="text-base sm:text-lg font-bold">{count}</div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[8px] sm:text-[9px] uppercase tracking-widest text-white/40">
                          {count === 1 ? 'vote' : 'votes'}
                        </div>
                      </div>
                      <button onClick={() => confirm(`Delete "${p.title}"?`) && deleteProject(p.id)}
                        className="text-white/30 hover:text-[#ff7a6b] transition p-1.5 sm:p-2 flex-shrink-0">
                        <Trash2 size={14} className="sm:size-16" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* How it works */}
        <div className="mt-6 sm:mt-10 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/10" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <h3 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-lg sm:text-xl text-white mb-3 sm:mb-4">How it works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm" style={{ fontFamily: 'Inter Tight, sans-serif' }}>
            <Step n="01" title="Add projects">
              Enter each project's title, student name, and grade in the Admin panel.
            </Step>
            <Step n="02" title="Print QRs">
              Go to QR Codes, print the sheet, and stick one at each project's booth.
            </Step>
            <Step n="03" title="Go live">
              Open Display on a projector. Votes stream in, leaderboard updates in real time.
            </Step>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/50 block mb-1 sm:mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg bg-black/30 border border-white/10 text-white focus:border-[#c8ff2e] focus:outline-none transition text-sm"
        style={{ fontFamily: 'Inter Tight, sans-serif' }}
      />
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[9px] sm:text-xs text-[#c8ff2e] mb-1 sm:mb-2">{n}</div>
      <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-sm sm:text-base text-white mb-0.5 sm:mb-1">{title}</div>
      <p className="text-white/60 text-xs sm:text-sm">{children}</p>
    </div>
  );
}

// ============================================================================
// ADMIN LOGIN — magic link flow
// ============================================================================
function AdminLogin({ signIn, authError, authPending, authEmailSent }) {
  const [email, setEmail] = useState('');

  const submit = (e) => {
    e?.preventDefault?.();
    if (!email.trim() || authPending) return;
    signIn(email.trim());
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-6 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,94,184,0.15)', border: '1px solid rgba(255,94,184,0.3)' }}>
              <ShieldCheck size={16} className="sm:size-20" style={{ color: '#ff5eb8' }} />
            </div>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-white/50">
                Restricted
              </div>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-lg sm:text-2xl text-white leading-tight">
                Admin sign in
              </h2>
            </div>
          </div>

          {authEmailSent ? (
            <div className="text-center py-3 sm:py-4">
              <div className="inline-flex items-center justify-center w-10 sm:w-12 h-10 sm:h-12 rounded-full mb-3 sm:mb-4"
                style={{ background: 'rgba(200,255,46,0.15)', border: '1px solid rgba(200,255,46,0.3)' }}>
                <Mail size={18} className="sm:size-20 text-[#c8ff2e]" />
              </div>
              <p style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-white text-base sm:text-lg mb-1 sm:mb-2">
                Check your inbox
              </p>
              <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-xs sm:text-sm text-white/60">
                We sent a magic link. Click it from the same browser and you'll land back here signed in.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-xs sm:text-sm text-white/60 mb-4 sm:mb-5">
                Admin access is restricted to pre-approved emails. Enter yours to receive a one-click sign-in link.
              </p>
              <div className="space-y-3">
                <div>
                  <label style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/50 block mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submit(e)}
                    placeholder="you@example.com"
                    autoFocus
                    className="w-full px-3 py-2 sm:py-2.5 rounded-lg bg-black/30 border border-white/10 text-white focus:border-[#c8ff2e] focus:outline-none transition text-sm"
                    style={{ fontFamily: 'Inter Tight, sans-serif' }}
                  />
                </div>

                {authError && (
                  <div className="p-2.5 sm:p-3 rounded-lg flex items-start gap-2" style={{ background: 'rgba(255,122,107,0.08)', border: '1px solid rgba(255,122,107,0.3)' }}>
                    <AlertCircle size={12} className="sm:size-14 text-[#ff7a6b] flex-shrink-0 mt-0.5" />
                    <p style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] sm:text-xs text-white/80">{authError}</p>
                  </div>
                )}

                <button onClick={submit} disabled={authPending || !email.trim()}
                  className="w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-[#c8ff2e] text-black font-semibold hover:scale-[1.01] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                  style={{ fontFamily: 'Inter Tight, sans-serif' }}>
                  {authPending ? (<><Loader2 size={14} className="sm:size-16 animate-spin" /> Sending...</>) : (<><Mail size={14} className="sm:size-16" /> Send magic link</>)}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ROOT
// ============================================================================
export default function App() {
  useFonts();
  const [view, setView] = useState('display');
  const [projects, setProjects] = useState([]);
  const [votes, setVotes] = useState([]);
  const [voterId, setVoterId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastVoteFlash, setLastVoteFlash] = useState(null);
  const votesRef = useRef([]);

  // Auth state for admin
  const [session, setSession] = useState(null);
  const [authError, setAuthError] = useState('');
  const [authPending, setAuthPending] = useState(false);
  const [authEmailSent, setAuthEmailSent] = useState(false);

  // ----- Initial load: voter ID, projects, votes, auth session -----
  useEffect(() => {
    setVoterId(getOrCreateVoterId());

    (async () => {
      const [p, v, sessionRes] = await Promise.all([
        db.fetchProjects(),
        db.fetchVotes(),
        supabase.auth.getSession(),
      ]);
      setProjects(p);
      setVotes(v);
      votesRef.current = v;
      setSession(sessionRes.data.session);
      setLoading(false);
    })();

    // Listen for auth state changes (magic-link redirect lands here).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setAuthEmailSent(false);
        setAuthError('');
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ----- Realtime subscriptions: live updates across ALL devices -----
  // This is the big win over localStorage: when a voter taps their phone, the
  // projector's leaderboard updates within ~500ms with no polling.
  useEffect(() => {
    if (loading) return;

    const channel = supabase
      .channel('scifair-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, async () => {
        const p = await db.fetchProjects();
        setProjects(p);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, async (payload) => {
        const newVote = {
          id: payload.new.id,
          projectId: payload.new.project_id,
          voterId: payload.new.voter_id,
          timestamp: new Date(payload.new.created_at).getTime(),
        };
        setVotes(prev => {
          // Guard against echoes of our own optimistic insert.
          if (prev.some(v => v.id === newVote.id)) return prev;
          const next = [...prev, newVote];
          votesRef.current = next;
          return next;
        });
        setLastVoteFlash(newVote.projectId);
        setTimeout(() => setLastVoteFlash(null), 2000);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'votes' }, async () => {
        // Re-fetch on delete. DELETE payloads only contain the primary key,
        // and batched deletes (reset all) are easier to handle with a refetch.
        const v = await db.fetchVotes();
        setVotes(v);
        votesRef.current = v;
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[realtime] subscription issue:', status,
            '— check that Realtime is enabled on projects + votes tables in Supabase.');
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [loading]);

  // ----- Derived state -----
  const voteCount = useMemo(() => {
    const map = {};
    projects.forEach(p => { map[p.id] = 0; });
    votes.forEach(v => { if (map[v.projectId] !== undefined) map[v.projectId]++; });
    return map;
  }, [projects, votes]);

  const sortedProjects = useMemo(() =>
    [...projects].sort((a, b) => (voteCount[b.id] || 0) - (voteCount[a.id] || 0)),
  [projects, voteCount]);

  const hasVoted = useMemo(() => votes.some(v => v.voterId === voterId), [votes, voterId]);
  const myVote = useMemo(() => votes.find(v => v.voterId === voterId), [votes, voterId]);
  const recentVotes = useMemo(() => [...votes].slice(-10).reverse(), [votes]);

  const tightRaces = useMemo(() => {
    const r = [];
    for (let i = 0; i < sortedProjects.length - 1; i++) {
      const a = sortedProjects[i], b = sortedProjects[i + 1];
      const diff = (voteCount[a.id] || 0) - (voteCount[b.id] || 0);
      if (diff <= 2 && (voteCount[a.id] || 0) > 0) {
        r.push([a, b, diff]);
      }
    }
    return r;
  }, [sortedProjects, voteCount]);

  // ----- Auth actions -----
  const signIn = useCallback(async (email) => {
    setAuthPending(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setAuthEmailSent(true);
    } catch (err) {
      setAuthError(err.message || 'Sign-in failed. Check your email and try again.');
    } finally {
      setAuthPending(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  // ----- Data actions -----
  const addProject = useCallback(async (data) => {
    const np = {
      id: genId('p'),
      title: data.title.trim(),
      student: data.student.trim(),
      grade: data.grade.trim(),
      emoji: data.emoji,
      color: data.color,
      createdAt: Date.now(),
    };
    // Optimistic update — realtime will confirm, or we rollback on error.
    setProjects(prev => [...prev, np]);
    try {
      await db.insertProject(np);
    } catch (err) {
      setProjects(prev => prev.filter(p => p.id !== np.id));
      alert(
        err.message?.includes('row-level security')
          ? 'Permission denied. Is this email listed in the admins table?'
          : 'Failed to save project: ' + (err.message || 'unknown error')
      );
    }
  }, []);

  const deleteProject = useCallback(async (id) => {
    const prevProjects = projects;
    const prevVotes = votes;
    setProjects(prev => prev.filter(p => p.id !== id));
    setVotes(prev => {
      const next = prev.filter(v => v.projectId !== id);
      votesRef.current = next;
      return next;
    });
    try {
      await db.deleteProject(id);
    } catch (err) {
      setProjects(prevProjects);
      setVotes(prevVotes);
      votesRef.current = prevVotes;
      alert('Failed to delete: ' + (err.message || 'unknown error'));
    }
  }, [projects, votes]);

  const castVote = useCallback(async (projectId) => {
    if (!voterId) return;
    if (votes.some(v => v.voterId === voterId)) return;
    setLastVoteFlash(projectId);
    setTimeout(() => setLastVoteFlash(null), 2000);
    try {
      await db.insertVote(projectId, voterId);
      // Realtime INSERT handler will append the vote to local state.
    } catch (err) {
      if (err.message === 'ALREADY_VOTED') {
        // Pull fresh votes so hasVoted becomes true in the UI.
        const v = await db.fetchVotes();
        setVotes(v);
        votesRef.current = v;
      } else {
        alert('Vote failed: ' + (err.message || 'unknown error'));
      }
    }
  }, [votes, voterId]);

  const resetAll = useCallback(async () => {
    if (!confirm('Reset ALL projects and votes? This cannot be undone.')) return;
    const prevProjects = projects;
    const prevVotes = votes;
    setProjects([]);
    setVotes([]);
    votesRef.current = [];
    try {
      await db.resetAllProjects();
    } catch (err) {
      setProjects(prevProjects);
      setVotes(prevVotes);
      votesRef.current = prevVotes;
      alert('Reset failed: ' + (err.message || 'unknown error'));
    }
  }, [projects, votes]);

  const resetMyVote = useCallback(async () => {
    if (!voterId) return;
    try {
      await db.resetMyVote(voterId);
      // Realtime DELETE handler will refresh votes list.
    } catch (err) {
      alert('Reset vote failed: ' + (err.message || 'unknown error'));
    }
  }, [voterId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#07070c' }}>
        <AmbientBG />
        <div className="text-center">
          <Atom size={32} className="text-[#c8ff2e] mx-auto mb-3 animate-spin" style={{ animationDuration: '3s' }} />
          <p style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs uppercase tracking-[0.3em] text-white/50">Booting voting console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ fontFamily: 'Inter Tight, sans-serif' }}>
      <AmbientBG />
      <Nav view={view} setView={setView} totalVotes={votes.length} />

      {view === 'display' && (
        <DisplayView
          projects={projects}
          votes={votes}
          voteCount={voteCount}
          sortedProjects={sortedProjects}
          recentVotes={recentVotes}
          tightRaces={tightRaces}
          lastVoteFlash={lastVoteFlash}
        />
      )}
      {view === 'vote' && (
        <VoteView
          projects={projects}
          voteCount={voteCount}
          hasVoted={hasVoted}
          myVote={myVote}
          castVote={castVote}
          resetMyVote={resetMyVote}
        />
      )}
      {view === 'qr' && <QRView projects={projects} />}
      {view === 'admin' && (
        <AdminView
          projects={projects}
          votes={votes}
          voteCount={voteCount}
          addProject={addProject}
          deleteProject={deleteProject}
          resetAll={resetAll}
          session={session}
          signIn={signIn}
          signOut={signOut}
          authError={authError}
          authPending={authPending}
          authEmailSent={authEmailSent}
        />
      )}

      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        body { background: #07070c; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        
        @keyframes rocketMotion0 {
          0% { transform: translateY(0) rotateZ(0deg) scaleY(1); }
          10% { transform: translateY(-2px) rotateZ(-1deg) scaleY(1.05); }
          20% { transform: translateY(-4px) rotateZ(2deg) scaleY(0.98); }
          30% { transform: translateY(-8px) rotateZ(-1deg) scaleY(1.02); }
          40% { transform: translateY(-25px) rotateZ(3deg) scaleY(0.95); }
          50% { transform: translateY(-35px) rotateZ(-2deg) scaleY(1); }
          60% { transform: translateY(-28px) rotateZ(1deg) scaleY(1.02); }
          70% { transform: translateY(-15px) rotateZ(-1deg) scaleY(0.98); }
          80% { transform: translateY(-5px) rotateZ(1deg) scaleY(1.01); }
          100% { transform: translateY(0) rotateZ(0deg) scaleY(1); }
        }
        
        @keyframes parabolaPath {
          0% { 
            transform: translateX(0) translateY(0) rotateZ(0deg) scale(1); 
            opacity: 1;
          }
          10% { 
            transform: translateX(60px) translateY(-40px) rotateZ(25deg) scale(1.05); 
            opacity: 1;
          }
          20% { 
            transform: translateX(150px) translateY(-150px) rotateZ(45deg) scale(1.1); 
            opacity: 1;
          }
          30% { 
            transform: translateX(200px) translateY(-300px) rotateZ(60deg) scale(1.08); 
            opacity: 1;
          }
          40% { 
            transform: translateX(150px) translateY(-450px) rotateZ(45deg) scale(1); 
            opacity: 0.9;
          }
          50% { 
            transform: translateX(0px) translateY(-500px) rotateZ(0deg) scale(0.95); 
            opacity: 0.8;
          }
          60% { 
            transform: translateX(-150px) translateY(-400px) rotateZ(-45deg) scale(1); 
            opacity: 0.9;
          }
          70% { 
            transform: translateX(-200px) translateY(-250px) rotateZ(-60deg) scale(1.08); 
            opacity: 1;
          }
          80% { 
            transform: translateX(-100px) translateY(-80px) rotateZ(-35deg) scale(1.05); 
            opacity: 1;
          }
          90% { 
            transform: translateX(-30px) translateY(-20px) rotateZ(-10deg) scale(1.02); 
            opacity: 1;
          }
          100% { 
            transform: translateX(0) translateY(0) rotateZ(0deg) scale(1); 
            opacity: 1;
          }
        }
        
        @keyframes flameGlow {
          0%, 100% { 
            height: 16px; 
            opacity: 0.9;
            boxShadow: 0 0 20px #ff6600, 0 0 40px rgba(255,102,0,0.7);
            filter: drop-shadow(0 0 8px #ff9933);
          }
          50% { 
            height: 20px; 
            opacity: 1;
            boxShadow: 0 0 30px #ff6600, 0 0 60px rgba(255,102,0,1), 0 0 10px #ff9933;
            filter: drop-shadow(0 0 15px #ff6600);
          }
        }
        
        @keyframes flameWaveLeft {
          0%, 100% { 
            boxShadow: 0 0 40px rgba(255,68,68,0.4), inset 0 0 20px rgba(255,122,107,0.1);
          }
          50% { 
            boxShadow: 0 0 80px rgba(255,68,68,0.8), inset 0 0 40px rgba(255,122,107,0.3), inset 60px 0 80px rgba(255,68,68,0.3);
          }
        }
        
        @keyframes flamesInFromRight {
          0% { 
            transform: translateX(100%);
            opacity: 0;
          }
          30% {
            opacity: 0.6;
          }
          70% {
            opacity: 0.3;
          }
          100% { 
            transform: translateX(-100%);
            opacity: 0;
          }
        }
        
        @keyframes flamesWaveRight {
          0%, 100% { 
            transform: translateY(-50%) translateX(0);
            opacity: 0.3;
          }
          50% { 
            transform: translateY(-50%) translateX(-40px);
            opacity: 0.8;
          }
        }
        
        @keyframes rocketMotion2 {
          0% { transform: translateY(0) rotateZ(0deg) scaleY(1); }
          14% { transform: translateY(-3px) rotateZ(-2deg) scaleY(1.05); }
          24% { transform: translateY(-6px) rotateZ(1deg) scaleY(0.98); }
          34% { transform: translateY(-12px) rotateZ(-2deg) scaleY(1.04); }
          44% { transform: translateY(-30px) rotateZ(2deg) scaleY(0.96); }
          54% { transform: translateY(-40px) rotateZ(-1deg) scaleY(1); }
          64% { transform: translateY(-32px) rotateZ(2deg) scaleY(1.01); }
          74% { transform: translateY(-17px) rotateZ(-1deg) scaleY(0.99); }
          84% { transform: translateY(-7px) rotateZ(1deg) scaleY(1.02); }
          100% { transform: translateY(0) rotateZ(0deg) scaleY(1); }
        }
        
        @keyframes rocketMotion3 {
          0% { transform: translateY(0) rotateZ(0deg) scaleY(1); }
          16% { transform: translateY(-2px) rotateZ(2deg) scaleY(1.04); }
          26% { transform: translateY(-5px) rotateZ(-1deg) scaleY(0.99); }
          36% { transform: translateY(-14px) rotateZ(2deg) scaleY(1.03); }
          46% { transform: translateY(-32px) rotateZ(-3deg) scaleY(0.95); }
          56% { transform: translateY(-42px) rotateZ(1deg) scaleY(1); }
          66% { transform: translateY(-34px) rotateZ(-2deg) scaleY(1.02); }
          76% { transform: translateY(-18px) rotateZ(1deg) scaleY(0.98); }
          86% { transform: translateY(-8px) rotateZ(-1deg) scaleY(1.01); }
          100% { transform: translateY(0) rotateZ(0deg) scaleY(1); }
        }
        
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(200,255,46,0.4); }
          50% { box-shadow: 0 0 40px rgba(200,255,46,0.8); }
        }
        
        @keyframes slideIn0 { 
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn1 { 
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn2 { 
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn3 { 
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn4 { 
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn5 { 
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn6 { 
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn7 { 
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @media print {
          nav, button { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
