import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus, Trash2, X, Check, Flame, Monitor, Settings, RotateCcw, Crown, Award,
  Medal, QrCode, ChevronRight, Beaker, Atom as AtomIcon, Microscope, Vote,
  Radio, AlertCircle, Info, Printer, Wifi, WifiOff,
} from 'lucide-react';
import App from './science_fair_voting.jsx';

// ============================================================================
// CONSTANTS
// ============================================================================
const STORAGE_KEYS = {
  projects: 'scifair:projects:v1',
  votes:    'scifair:votes:v1',
  voterId:  'scifair:voterId:v1',
};

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
// SCIENCE ANIMATIONS — atoms, rockets, sparkles
// ============================================================================
function SpinningAtom({ top, left, size, dur, color, opacity = 0.3 }) {
  // Stable unique id for <mpath href>
  const uid = useMemo(() => 'orbit_' + Math.random().toString(36).slice(2, 9), []);
  // Full-ellipse path centered at (50,50) using two arcs.
  const ellipsePath = 'M 50 50 m -45 0 a 45 14 0 1 0 90 0 a 45 14 0 1 0 -90 0';
  const orbits = [
    { angle: 0,   durMul: 1.0 },
    { angle: 60,  durMul: 0.85 },
    { angle: 120, durMul: 1.15 },
  ];
  return (
    <div
      className="absolute"
      style={{
        top, left,
        width: size, height: size,
        opacity,
        animation: `atomDrift ${dur * 1.4}s ease-in-out infinite`,
        willChange: 'transform',
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <radialGradient id={`glow_${uid}`}>
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="60%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          {orbits.map((_, i) => (
            <path key={i} id={`${uid}_${i}`} d={ellipsePath} />
          ))}
        </defs>

        {/* Nucleus halo */}
        <circle cx="50" cy="50" r="14" fill={`url(#glow_${uid})`} />

        {/* Orbits */}
        {orbits.map((o, i) => (
          <g key={i} transform={`rotate(${o.angle} 50 50)`}>
            <path
              d={ellipsePath}
              stroke={color}
              strokeOpacity="0.32"
              strokeWidth="0.6"
              fill="none"
            />
            <circle r="1.8" fill={color}>
              <animateMotion
                dur={`${dur * o.durMul}s`}
                repeatCount="indefinite"
                rotate="auto"
              >
                <mpath href={`#${uid}_${i}`} />
              </animateMotion>
            </circle>
          </g>
        ))}

        {/* Nucleus core */}
        <circle cx="50" cy="50" r="3.5" fill={color} opacity="0.95" />
      </svg>
    </div>
  );
}

function Rocket({ left, delay, dur, drift, color }) {
  return (
    <div
      className="absolute bottom-0"
      style={{
        left,
        animation: `rocketRise ${dur} cubic-bezier(0.4, 0, 0.6, 1) infinite`,
        animationDelay: delay,
        '--rocket-drift': drift,
        willChange: 'transform, opacity',
      }}
    >
      <svg width="22" height="44" viewBox="0 0 40 80" style={{ display: 'block', filter: `drop-shadow(0 0 6px ${color}55)` }}>
        {/* Exhaust flame (flickering) */}
        <g style={{ animation: 'rocketFlame 0.15s ease-in-out infinite alternate', transformOrigin: '20px 60px' }}>
          <path d="M14 60 Q20 82 26 60 Q20 70 14 60 Z" fill="#ffc857" />
          <path d="M16 60 Q20 76 24 60 Q20 68 16 60 Z" fill="#ff7a6b" />
          <path d="M18 60 Q20 70 22 60 Z" fill="#ffffff" />
        </g>
        {/* Body */}
        <path d="M20 6 L30 38 L30 60 L10 60 L10 38 Z" fill="#f5f2e8" />
        {/* Nose */}
        <path d="M20 6 L30 38 L10 38 Z" fill={color} />
        {/* Fins */}
        <path d="M10 60 L3 72 L10 60 Z" fill={color} />
        <path d="M30 60 L37 72 L30 60 Z" fill={color} />
        <path d="M10 52 L3 72 L10 68 Z" fill={color} opacity="0.8" />
        <path d="M30 52 L37 72 L30 68 Z" fill={color} opacity="0.8" />
        {/* Porthole */}
        <circle cx="20" cy="36" r="3.5" fill="#07070c" />
        <circle cx="20" cy="36" r="3.5" fill={color} opacity="0.25" />
        <circle cx="19" cy="35" r="1" fill="#ffffff" opacity="0.8" />
      </svg>
    </div>
  );
}

function ScienceAnimations() {
  // Stable configs per-mount so elements don't re-randomize each render.
  const atoms = useMemo(() => [
    { top: '14%', left: '6%',  size: 110, dur: 18, color: '#c8ff2e', opacity: 0.28 },
    { top: '68%', left: '88%', size: 140, dur: 24, color: '#5eeaff', opacity: 0.24 },
    { top: '82%', left: '12%', size: 90,  dur: 20, color: '#ff5eb8', opacity: 0.22 },
    { top: '22%', left: '78%', size: 80,  dur: 26, color: '#b196ff', opacity: 0.22 },
    { top: '48%', left: '45%', size: 70,  dur: 22, color: '#ffc857', opacity: 0.14 },
  ], []);

  const rockets = useMemo(() => [
    { left: '8%',  delay: '0s',   dur: '16s', drift: '18px',  color: '#c8ff2e' },
    { left: '28%', delay: '6s',   dur: '18s', drift: '-12px', color: '#5eeaff' },
    { left: '55%', delay: '3s',   dur: '14s', drift: '22px',  color: '#ff5eb8' },
    { left: '78%', delay: '9s',   dur: '19s', drift: '-20px', color: '#ffc857' },
    { left: '92%', delay: '12s',  dur: '17s', drift: '10px',  color: '#b196ff' },
  ], []);

  const sparkles = useMemo(() => (
    Array.from({ length: 14 }).map((_, i) => ({
      top: `${Math.random() * 95}%`,
      left: `${Math.random() * 98}%`,
      dur: 2 + Math.random() * 4,
      delay: Math.random() * 5,
      size: 1.5 + Math.random() * 2,
    }))
  ), []);

  return (
    <div className="scifair-anim fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {atoms.map((a, i) => <SpinningAtom key={i} {...a} />)}
      {rockets.map((r, i) => <Rocket key={i} {...r} />)}
      {sparkles.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            top: s.top, left: s.left,
            width: s.size, height: s.size,
            background: 'white',
            opacity: 0,
            animation: `sparkleTwinkle ${s.dur}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
            boxShadow: '0 0 4px rgba(255,255,255,0.8)',
          }}
        />
      ))}

      <style>{`
        @keyframes atomDrift {
          0%, 100% { transform: translate(0, 0); }
          25%      { transform: translate(18px, -14px); }
          50%      { transform: translate(-10px, 18px); }
          75%      { transform: translate(-22px, -8px); }
        }
        @keyframes rocketRise {
          0%   { transform: translateY(20vh) translateX(0) rotate(-6deg); opacity: 0; }
          6%   { opacity: 0.4; }
          55%  { transform: translateY(-50vh) translateX(calc(var(--rocket-drift) * 0.6)) rotate(4deg); opacity: 0.5; }
          92%  { opacity: 0.3; }
          100% { transform: translateY(-115vh) translateX(var(--rocket-drift)) rotate(8deg); opacity: 0; }
        }
        @keyframes rocketFlame {
          0%   { transform: scaleY(0.85) scaleX(1.05); }
          100% { transform: scaleY(1.15) scaleX(0.9); }
        }
        @keyframes sparkleTwinkle {
          0%, 100% { opacity: 0; transform: scale(0.6); }
          50%      { opacity: 0.8; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// AMBIENT BACKGROUND (gradient mesh + grain)
// ============================================================================
function AmbientBG() {
  return (
    <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none">
      <div className="absolute inset-0" style={{ background: '#07070c' }} />
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, #5eeaff 0%, transparent 70%)', animation: 'drift1 22s ease-in-out infinite' }} />
      <div className="absolute top-1/3 -right-40 w-[700px] h-[700px] rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #ff5eb8 0%, transparent 70%)', animation: 'drift2 28s ease-in-out infinite' }} />
      <div className="absolute -bottom-40 left-1/4 w-[650px] h-[650px] rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #c8ff2e 0%, transparent 70%)', animation: 'drift3 25s ease-in-out infinite' }} />
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
function Nav({ view, setView, totalVotes, isLive }) {
  const items = [
    { id: 'display', label: 'Display', icon: Monitor },
    { id: 'vote',    label: 'Vote',    icon: Vote },
    { id: 'qr',      label: 'QR Codes', icon: QrCode },
    { id: 'admin',   label: 'Admin',   icon: Settings },
  ];
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 backdrop-blur-xl bg-black/40 border-b border-white/5">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#c8ff2e,#5eeaff)' }}>
            <AtomIcon size={18} className="text-black" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 18, letterSpacing: '-0.02em' }} className="text-white">Scifair Live</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }} className="text-white/40 tracking-wider uppercase mt-0.5">voting console</span>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm transition-all ${
                view === id
                  ? 'bg-white text-black font-semibold'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              style={{ fontFamily: 'Inter Tight, sans-serif' }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
          title={isLive ? 'Live backend — votes sync across devices' : 'Local-only — votes do NOT sync across devices'}>
          <div className="relative">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-[#c8ff2e]' : 'bg-[#ffc857]'}`} />
            <div className={`absolute inset-0 w-2 h-2 rounded-full animate-ping ${isLive ? 'bg-[#c8ff2e]' : 'bg-[#ffc857]'}`} />
          </div>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs text-white/70">
            {totalVotes.toString().padStart(3, '0')} · {isLive ? 'LIVE' : 'LOCAL'}
          </span>
          {isLive ? <Wifi size={11} className="text-[#c8ff2e]" /> : <WifiOff size={11} className="text-[#ffc857]" />}
        </div>
      </div>
    </nav>
  );
}

// ============================================================================
// DISPLAY VIEW
// ============================================================================
function DisplayView({ projects, votes, voteCount, sortedProjects, recentVotes, tightRaces, lastVoteFlash }) {
  const topVotes = sortedProjects[0] ? voteCount[sortedProjects[0].id] || 0 : 0;
  const maxBar = Math.max(topVotes, 1);
  const [, setTick] = useState(0);
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
    <div className="min-h-screen pt-24 pb-12 px-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs uppercase tracking-[0.3em] text-[#c8ff2e]">
                ◆ Live Standings
              </span>
            </div>
            <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 300, letterSpacing: '-0.04em' }} className="text-white leading-[0.9]">
              <span className="block text-6xl md:text-8xl">The Science</span>
              <span className="block text-6xl md:text-8xl italic" style={{ color: '#c8ff2e' }}>Fair</span>
            </h1>
          </div>
          <div className="hidden md:flex flex-col items-end gap-3">
            <StatPill label="Projects" value={projects.length} />
            <StatPill label="Votes Cast" value={votes.length} highlight />
            <StatPill label="Leader" value={sortedProjects[0]?.title.slice(0, 18) || '—'} mono={false} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          <div className="space-y-3">
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
                    background: flashing ? c.soft : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${flashing ? c.hex : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: flashing ? `0 0 40px ${c.glow}` : 'none',
                    transform: flashing ? 'scale(1.005)' : 'scale(1)',
                  }}
                >
                  <div className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${c.hex}22 0%, ${c.hex}08 100%)`,
                      borderRight: `2px solid ${c.hex}`,
                    }} />
                  <div className="relative flex items-center gap-5 p-5">
                    <div className="flex-shrink-0 w-14">
                      <RankBadge rank={idx + 1} isLeader={isLeader} />
                    </div>
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="text-4xl flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-xl"
                        style={{ background: c.soft, border: `1px solid ${c.hex}33` }}>
                        {p.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500, letterSpacing: '-0.01em' }} className="text-xl md:text-2xl text-white truncate">
                          {p.title}
                        </h3>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs text-white/50 mt-1 flex items-center gap-2">
                          <span>{p.student}</span>
                          <span className="w-1 h-1 rounded-full bg-white/30" />
                          <span>Grade {p.grade}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 300, color: c.hex, letterSpacing: '-0.04em' }}
                        className={`text-5xl md:text-6xl leading-none transition-transform duration-300 ${flashing ? 'scale-110' : 'scale-100'}`}>
                        {count}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] uppercase tracking-widest text-white/40 mt-1">
                        {count === 1 ? 'vote' : 'votes'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-6">
            <TightRacesPanel races={tightRaces} />
            <RecentVotesPanel votes={recentVotes} projects={projects} />
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

function RankBadge({ rank, isLeader }) {
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
    <div className="rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(255,94,184,0.05)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Flame size={16} style={{ color: '#ff5eb8' }} />
        <h3 style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs uppercase tracking-[0.2em] text-[#ff5eb8]">
          Tight Races
        </h3>
      </div>
      {races.length === 0 ? (
        <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-sm text-white/40">
          No close competitions yet. Let the votes flow.
        </p>
      ) : (
        <div className="space-y-3">
          {races.slice(0, 3).map(([a, b, diff], i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-white text-sm truncate">{a.emoji} {a.title}</div>
                <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-white/60 text-sm truncate mt-0.5">{b.emoji} {b.title}</div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs text-[#ff5eb8]">
                  {diff === 0 ? 'TIED' : `+${diff}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentVotesPanel({ votes, projects }) {
  return (
    <div className="rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(94,234,255,0.04)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Radio size={16} style={{ color: '#5eeaff' }} />
        <h3 style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs uppercase tracking-[0.2em] text-[#5eeaff]">
          Vote Stream
        </h3>
        <div className="flex-1" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#5eeaff] animate-pulse" />
      </div>
      {votes.length === 0 ? (
        <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-sm text-white/40">
          Waiting for the first vote...
        </p>
      ) : (
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {votes.map((v, i) => {
            const proj = projects.find(p => p.id === v.projectId);
            if (!proj) return null;
            const c = colorOf(proj.color);
            return (
              <div key={v.timestamp + '-' + i} className="flex items-center gap-3 p-2.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)', animation: i === 0 ? 'slideIn 0.4s ease-out' : 'none' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.hex, boxShadow: `0 0 8px ${c.glow}` }} />
                <div className="text-lg">{proj.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-white text-sm truncate">{proj.title}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] text-white/40 mt-0.5">{timeAgo(v.timestamp)}</div>
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
function VoteView({ projects, voteCount, hasVoted, myVote, castVote, resetMyVote, preselectedProjectId }) {
  const [pending, setPending] = useState(null);
  const [justVoted, setJustVoted] = useState(false);

  // If a project ID was passed via ?p=, auto-open its confirm dialog once.
  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (openedFromUrl.current) return;
    if (!preselectedProjectId || hasVoted) return;
    const target = projects.find(p => p.id === preselectedProjectId);
    if (target) {
      setPending(target);
      openedFromUrl.current = true;
    }
  }, [preselectedProjectId, projects, hasVoted]);

  const confirmVote = async () => {
    if (!pending) return;
    await castVote(pending.id);
    setJustVoted(true);
    setPending(null);
    setTimeout(() => setJustVoted(false), 2500);
  };

  if (projects.length === 0) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="text-center">
          <Beaker size={48} className="text-white/30 mx-auto mb-4" />
          <p style={{ fontFamily: 'Fraunces, serif' }} className="text-white/60 text-2xl">No projects to vote on yet.</p>
        </div>
      </div>
    );
  }

  if (hasVoted) {
    const votedProject = projects.find(p => p.id === myVote?.projectId);
    const c = votedProject ? colorOf(votedProject.color) : ACCENT_COLORS[0];
    return (
      <div className="min-h-screen pt-24 pb-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-3xl p-10 text-center relative overflow-hidden"
            style={{ background: c.soft, border: `1px solid ${c.hex}44` }}>
            <div className="absolute inset-0 opacity-30 blur-3xl"
              style={{ background: `radial-gradient(circle at 50% 30%, ${c.hex}, transparent 70%)` }} />
            <div className="relative">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
                style={{ background: c.hex }}>
                <Check size={32} className="text-black" strokeWidth={3} />
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', color: c.hex }} className="text-xs uppercase tracking-[0.3em] mb-3">
                Vote recorded
              </div>
              <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 300 }} className="text-4xl md:text-5xl text-white mb-4 leading-tight">
                Thank you for voting for
              </h1>
              <div className="text-6xl mb-4">{votedProject?.emoji}</div>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500, color: c.hex }} className="text-3xl mb-1">
                {votedProject?.title}
              </h2>
              <p style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-sm text-white/50">
                by {votedProject?.student} · Grade {votedProject?.grade}
              </p>
              <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-white/50 mt-8 mb-6 max-w-md mx-auto">
                Your vote has been locked in. One vote per attendee — you're done. Check the Display to see live standings.
              </p>
              <button onClick={resetMyVote}
                className="text-xs text-white/30 hover:text-white/60 underline transition"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                [reset my vote — testing only]
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs uppercase tracking-[0.3em] text-[#c8ff2e] mb-2">
            ◆ Cast your vote
          </div>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 300, letterSpacing: '-0.03em' }} className="text-5xl md:text-6xl text-white leading-none">
            Pick <span className="italic" style={{ color: '#c8ff2e' }}>one</span> favorite.
          </h1>
          <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-white/50 mt-3 max-w-xl">
            You get a single vote. Choose the project that impressed you most. Tap a card below to vote.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => {
            const c = colorOf(p.color);
            const count = voteCount[p.id] || 0;
            return (
              <button
                key={p.id}
                onClick={() => setPending(p)}
                className="group relative rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.02] overflow-hidden"
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
                <div className="absolute top-0 right-0 w-32 h-32 opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                  style={{ background: `radial-gradient(circle, ${c.hex}, transparent)` }} />
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-5xl">{p.emoji}</div>
                    <div className="text-right">
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', color: c.hex }} className="text-xs tracking-widest uppercase">
                        {count} {count === 1 ? 'vote' : 'votes'}
                      </div>
                    </div>
                  </div>
                  <h3 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500, letterSpacing: '-0.01em' }} className="text-2xl text-white mb-2 leading-tight">
                    {p.title}
                  </h3>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs text-white/50 flex items-center gap-2">
                    <span>{p.student}</span>
                    <span className="w-1 h-1 rounded-full bg-white/30" />
                    <span>Grade {p.grade}</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-sm text-white/60 group-hover:text-white transition">
                      Tap to vote
                    </span>
                    <ChevronRight size={16} className="text-white/30 group-hover:text-white transition group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm" onClick={() => setPending(null)}>
          <div className="relative rounded-2xl p-8 max-w-md w-full" style={{ background: '#0f0f1a', border: `1px solid ${colorOf(pending.color).hex}66` }}
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
  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : 'https://yourdomain.com/';

  return (
    <div className="min-h-screen pt-24 pb-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs uppercase tracking-[0.3em] text-[#5eeaff] mb-2">
              ◆ Print & place
            </div>
            <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 300, letterSpacing: '-0.03em' }} className="text-5xl text-white leading-none">
              Scan-to-vote QR codes
            </h1>
            <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-white/50 mt-3 max-w-xl">
              Print these and place one at each project's poster. Attendees scan → the voting dialog opens pre-selected to that project.
            </p>
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-black font-medium hover:scale-105 transition"
            style={{ fontFamily: 'Inter Tight, sans-serif' }}>
            <Printer size={16} /> Print
          </button>
        </div>

        <div className="rounded-xl p-4 mb-8 flex items-start gap-3" style={{ background: 'rgba(94,234,255,0.06)', border: '1px solid rgba(94,234,255,0.2)' }}>
          <Info size={16} className="text-[#5eeaff] flex-shrink-0 mt-0.5" />
          <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-sm text-white/70">
            <strong className="text-[#5eeaff]">QRs encode this URL:</strong>{' '}
            <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} className="text-white/90 break-all">{baseUrl}#/vote?p=…</code>{' '}
            — they regenerate automatically when you deploy to a public domain.
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20">
            <QrCode size={48} className="text-white/20 mx-auto mb-4" />
            <p style={{ fontFamily: 'Fraunces, serif' }} className="text-xl text-white/50">Add projects to generate QR codes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2">
            {projects.map((p) => {
              const c = colorOf(p.color);
              const voteLink = `${baseUrl}#/vote?p=${p.id}`;
              return (
                <div key={p.id} className="rounded-2xl p-6 break-inside-avoid"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.hex}33` }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-3xl">{p.emoji}</div>
                    <div className="w-2 h-2 rounded-full" style={{ background: c.hex }} />
                  </div>
                  <h3 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-xl text-white leading-tight mb-1">
                    {p.title}
                  </h3>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs text-white/50 mb-4">
                    {p.student} · Grade {p.grade}
                  </p>
                  <div className="rounded-xl p-3 flex items-center justify-center" style={{ background: '#0a0a14', border: `1px solid ${c.hex}22` }}>
                    <img src={qrUrl(voteLink, 220)} alt={`QR code for ${p.title}`} className="w-full h-auto max-w-[200px]" />
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] uppercase tracking-widest text-white/40 text-center mt-3">
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
function AdminView({ projects, votes, voteCount, addProject, deleteProject, resetAll, isLive }) {
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
    <div className="min-h-screen pt-24 pb-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs uppercase tracking-[0.3em] text-[#ff5eb8] mb-2">
            ◆ Event console
          </div>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 300, letterSpacing: '-0.03em' }} className="text-5xl text-white leading-none">
            Manage projects.
          </h1>
        </div>

        {!isLive && (
          <div className="rounded-xl p-4 mb-6 flex items-start gap-3" style={{ background: 'rgba(255,200,87,0.08)', border: '1px solid rgba(255,200,87,0.25)' }}>
            <AlertCircle size={16} className="text-[#ffc857] flex-shrink-0 mt-0.5" />
            <div>
              <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-sm text-white/80">
                <strong className="text-[#ffc857]">Running in LOCAL mode.</strong> Votes are stored on this device only — they won't appear on other phones or laptops.
              </p>
              <p style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs text-white/50 mt-1">
                Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable cross-device sync. See README.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
          <div className="rounded-2xl p-6 border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-2xl text-white mb-5 flex items-center gap-2">
              <Plus size={20} /> Add project
            </h2>
            <div className="space-y-4">
              <Field label="Project title" value={form.title} onChange={v => setForm({ ...form, title: v })} placeholder="e.g. Solar-Powered Water Purifier" />
              <Field label="Student name" value={form.student} onChange={v => setForm({ ...form, student: v })} placeholder="e.g. Maya Kapoor" />
              <Field label="Grade" value={form.grade} onChange={v => setForm({ ...form, grade: v })} placeholder="e.g. 8" />

              <div>
                <label style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] uppercase tracking-widest text-white/50 block mb-2">Icon</label>
                <div className="flex flex-wrap gap-1 p-2 rounded-lg bg-black/30 border border-white/5">
                  {EMOJI_POOL.map(e => (
                    <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                      className={`w-8 h-8 rounded flex items-center justify-center text-lg transition ${
                        form.emoji === e ? 'bg-white/20 scale-110' : 'hover:bg-white/10'
                      }`}>{e}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] uppercase tracking-widest text-white/50 block mb-2">Accent color</label>
                <div className="flex gap-2">
                  {ACCENT_COLORS.map(c => (
                    <button key={c.name} onClick={() => setForm({ ...form, color: c.name })}
                      className={`w-9 h-9 rounded-lg transition ${form.color === c.name ? 'ring-2 ring-white scale-110' : ''}`}
                      style={{ background: c.hex }} />
                  ))}
                </div>
              </div>

              {error && <p style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs text-[#ff7a6b]">{error}</p>}

              <button onClick={submit}
                className="w-full py-3 rounded-xl bg-[#c8ff2e] text-black font-semibold hover:scale-[1.01] transition"
                style={{ fontFamily: 'Inter Tight, sans-serif' }}>
                Add to fair
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-2xl text-white">
                Active projects
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-sm text-white/40 ml-3">{projects.length}</span>
              </h2>
              {(projects.length > 0 || votes.length > 0) && (
                <button onClick={resetAll} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-[#ff7a6b] transition px-3 py-1.5 rounded-full border border-white/10"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  <RotateCcw size={12} /> Reset event
                </button>
              )}
            </div>

            {projects.length === 0 ? (
              <div className="rounded-2xl p-12 text-center border border-dashed border-white/10">
                <p style={{ fontFamily: 'Fraunces, serif' }} className="text-white/40 text-lg italic">No projects added yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map(p => {
                  const c = colorOf(p.color);
                  const count = voteCount[p.id] || 0;
                  return (
                    <div key={p.id} className="rounded-xl p-4 flex items-center gap-4"
                      style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${c.hex}22` }}>
                      <div className="text-2xl">{p.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-white truncate">{p.title}</div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs text-white/50">
                          {p.student} · Grade {p.grade}
                        </div>
                      </div>
                      <div className="text-right">
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', color: c.hex }} className="text-lg font-bold">{count}</div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[9px] uppercase tracking-widest text-white/40">
                          {count === 1 ? 'vote' : 'votes'}
                        </div>
                      </div>
                      <button onClick={() => { if (window.confirm(`Delete "${p.title}"?`)) deleteProject(p.id); }}
                        className="text-white/30 hover:text-[#ff7a6b] transition p-2">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 rounded-2xl p-6 border border-white/10" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <h3 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-xl text-white mb-4">How it works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm" style={{ fontFamily: 'Inter Tight, sans-serif' }}>
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
      <label style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[10px] uppercase tracking-widest text-white/50 block mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white focus:border-[#c8ff2e] focus:outline-none transition"
        style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 14 }}
      />
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs text-[#c8ff2e] mb-2">{n}</div>
      <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }} className="text-white mb-1">{title}</div>
      <p className="text-white/60 text-sm">{children}</p>
    </div>
  );
}

// ============================================================================
// HASH ROUTING (tiny, no dependencies)
// ----------------------------------------------------------------------------
// URLs look like:   /#/vote            /#/display            /#/vote?p=p_abc123
// Hash routing works out-of-the-box on Vercel / Netlify with no server config
// beyond serving index.html — no rewrites needed for the app itself.
// ============================================================================
function parseHash(hash) {
  const raw = (hash || '').replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  const params = new URLSearchParams(query || '');
  const view = ['display', 'vote', 'qr', 'admin'].includes(path) ? path : 'display';
  return { view, params };
}

function useHashRoute() {
  const [state, setState] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setState(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((view) => {
    window.location.hash = `#/${view}`;
  }, []);
  return { ...state, navigate };
}

// ============================================================================
// ROOT
// ============================================================================
export default function App() {
  useFonts();
  const { view, params, navigate } = useHashRoute();
  const [projects, setProjects] = useState([]);
  const [votes, setVotes] = useState([]);
  const [voterId, setVoterId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastVoteFlash, setLastVoteFlash] = useState(null);
  const votesRef = useRef([]);

  const preselectedProjectId = params.get('p');

  // Initial load
  useEffect(() => {
    (async () => {
      let vid = storage.getLocal(STORAGE_KEYS.voterId);
      if (!vid) {
        vid = genId('v');
        storage.setLocal(STORAGE_KEYS.voterId, vid);
      }
      setVoterId(vid);

      const p = await storage.getShared(STORAGE_KEYS.projects);
      setProjects(p ? JSON.parse(p) : []);

      const v = await storage.getShared(STORAGE_KEYS.votes);
      const parsedVotes = v ? JSON.parse(v) : [];
      setVotes(parsedVotes);
      votesRef.current = parsedVotes;

      setLoading(false);
    })();
  }, []);

  // Refresh from shared storage
  const refresh = useCallback(async () => {
    const p = await storage.getShared(STORAGE_KEYS.projects);
    const v = await storage.getShared(STORAGE_KEYS.votes);
    const newProjects = p ? JSON.parse(p) : [];
    const newVotes = v ? JSON.parse(v) : [];
    if (newVotes.length > votesRef.current.length) {
      const latest = newVotes[newVotes.length - 1];
      setLastVoteFlash(latest.projectId);
      setTimeout(() => setLastVoteFlash(null), 2000);
    }
    setProjects(newProjects);
    setVotes(newVotes);
    votesRef.current = newVotes;
  }, []);

  // Realtime subscription (Supabase) + polling fallback
  useEffect(() => {
    if (loading) return;
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      unsub = await storage.subscribeShared(() => { if (!cancelled) refresh(); });
    })();
    const pollInterval = storage.isLive ? 15000 : 3000; // slow poll when we have realtime; fast when we don't
    const interval = setInterval(refresh, pollInterval);
    return () => { cancelled = true; unsub(); clearInterval(interval); };
  }, [loading, refresh]);

  // Derived state
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

  // Actions
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
    const updated = [...projects, np];
    setProjects(updated);
    await storage.setShared(STORAGE_KEYS.projects, JSON.stringify(updated));
  }, [projects]);

  const deleteProject = useCallback(async (id) => {
    const updated = projects.filter(p => p.id !== id);
    const updatedVotes = votes.filter(v => v.projectId !== id);
    setProjects(updated);
    setVotes(updatedVotes);
    votesRef.current = updatedVotes;
    await storage.setShared(STORAGE_KEYS.projects, JSON.stringify(updated));
    await storage.setShared(STORAGE_KEYS.votes, JSON.stringify(updatedVotes));
  }, [projects, votes]);

  const castVote = useCallback(async (projectId) => {
    // Re-read latest shared votes to reduce (not eliminate) lost-update races.
    const latestRaw = await storage.getShared(STORAGE_KEYS.votes);
    const latest = latestRaw ? JSON.parse(latestRaw) : [];
    if (latest.some(v => v.voterId === voterId)) {
      setVotes(latest);
      votesRef.current = latest;
      return;
    }
    const newVote = { projectId, voterId, timestamp: Date.now() };
    const updated = [...latest, newVote];
    setVotes(updated);
    votesRef.current = updated;
    setLastVoteFlash(projectId);
    setTimeout(() => setLastVoteFlash(null), 2000);
    await storage.setShared(STORAGE_KEYS.votes, JSON.stringify(updated));
  }, [voterId]);

  const resetAll = useCallback(async () => {
    if (!window.confirm('Reset ALL projects and votes? This cannot be undone.')) return;
    setProjects([]);
    setVotes([]);
    votesRef.current = [];
    await storage.setShared(STORAGE_KEYS.projects, JSON.stringify([]));
    await storage.setShared(STORAGE_KEYS.votes, JSON.stringify([]));
  }, []);

  const resetMyVote = useCallback(async () => {
    const latestRaw = await storage.getShared(STORAGE_KEYS.votes);
    const latest = latestRaw ? JSON.parse(latestRaw) : [];
    const updated = latest.filter(v => v.voterId !== voterId);
    setVotes(updated);
    votesRef.current = updated;
    await storage.setShared(STORAGE_KEYS.votes, JSON.stringify(updated));
  }, [voterId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#07070c' }}>
        <AmbientBG />
        <div className="text-center">
          <AtomIcon size={32} className="text-[#c8ff2e] mx-auto mb-3 animate-spin" style={{ animationDuration: '3s' }} />
          <p style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs uppercase tracking-[0.3em] text-white/50">Booting voting console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ fontFamily: 'Inter Tight, sans-serif' }}>
      <AmbientBG />
      <ScienceAnimations />
      <Nav view={view} setView={navigate} totalVotes={votes.length} isLive={storage.isLive} />

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
          preselectedProjectId={preselectedProjectId}
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
          isLive={storage.isLive}
        />
      )}
    </div>
  );
}
