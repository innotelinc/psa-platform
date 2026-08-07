import React, { Component, useEffect } from 'react';
import { X, AlertTriangle, RefreshCcw } from 'lucide-react';
import { iconStyle, PLATFORMS } from '../lib/platforms';
import type { Avatar } from '../lib/types';

// ------------------------------------------------------------------ Error Boundary
type EBState = { error: Error | null };
export class ErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 40 }}>
          <div className="aurora" />
          <div className="grid-bg" />
          <div style={{ textAlign: 'center', maxWidth: 480, position: 'relative', zIndex: 1 }}>
            <div style={{ width: 70, height: 70, borderRadius: 20, background: 'rgba(239,68,68,0.14)', display: 'grid', placeItems: 'center', margin: '0 auto 22px', fontSize: 28 }}>
              <AlertTriangle size={32} style={{ color: '#f87171' }} />
            </div>
            <h2 style={{ fontSize: 22, marginBottom: 8 }}>Something glitched</h2>
            <p className="muted small" style={{ lineHeight: 1.7, marginBottom: 20 }}>
              {this.state.error.message || 'The fame machine hit a bump.'}
            </p>
            <button className="btn primary" onClick={() => { this.setState({ error: null }); window.location.reload(); }}>
              <RefreshCcw size={16} /> Reload FameForge
            </button>
            <pre className="faint small mt-4" style={{ textAlign: 'left', background: 'rgba(0,0,0,0.35)', padding: 14, borderRadius: 12, overflow: 'auto', maxHeight: 200 }}>
              {this.state.error.stack}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Btn({ children, variant = '', size = '', className = '', style, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) {
  return (
    <button className={`btn ${variant} ${size} ${className}`} style={style} {...rest}>
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="toggle" style={{ opacity: disabled ? 0.4 : 1 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  );
}

export function Modal({ title, onClose, children, wide, footer }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="btn ghost sm" onClick={onClose} style={{ padding: 7 }}><X size={16} /></button>
        </div>
        {children}
        {footer && <div className="mt-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Avatar({ avatar, size = 44, round = 12 }: { avatar?: Avatar; size?: number; round?: number }) {
  const a = avatar || { style: 'gradient' as const, from: '#ff2d78', to: '#a855f7', emoji: '🔥', label: 'FF' };
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: round, display: 'grid', placeItems: 'center',
    fontSize: size * 0.42, fontWeight: 700, flexShrink: 0,
  };
  if (a.style === 'gradient' || !a.style) {
    style.background = `linear-gradient(135deg, ${a.from || '#ff2d78'}, ${a.to || '#a855f7'})`;
    style.boxShadow = `0 6px 20px ${(a.from || '#ff2d78')}55`;
  } else if (a.style === 'emoji') {
    style.background = `linear-gradient(135deg, ${a.from || '#ff2d78'}, ${a.to || '#a855f7'})`;
    style.fontSize = size * 0.5;
    style.color = '#fff';
  } else {
    style.background = `linear-gradient(135deg, ${a.from || '#ff2d78'}, ${a.to || '#a855f7'})`;
  }
  return (
    <div style={style}>
      {a.style === 'emoji' ? a.emoji || '🔥' : a.label || 'FF'}
    </div>
  );
}

export function PlatIcon({ id, size = 20, round = 13, glow = true }: { id: string; size?: number; round?: number; glow?: boolean }) {
  const s = iconStyle(id);
  return (
    <div className="channel-icon" style={{ width: size * 2.2, height: size * 2.2, borderRadius: round, ...s, boxShadow: glow ? s.boxShadow : 'none' }}>
      <PlatGlyph id={id} size={size} />
    </div>
  );
}

// icon glyph without the colored box (for marquees, pills)
export function PlatGlyph({ id, size = 18 }: { id: string; size?: number }) {
  const Icon = PLATFORMS.find((p) => p.id === id)?.icon;
  if (!Icon) return <span style={{ fontSize: size }}>🌐</span>;
  return <Icon size={size} strokeWidth={2.2} style={{ color: '#fff' }} />;
}

export function Chip({ children, tone = '', className = '' }: { children: React.ReactNode; tone?: string; className?: string }) {
  return <span className={`chip ${tone} ${className}`}>{children}</span>;
}

export function Empty({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div style={{ fontWeight: 600 }}>{title}</div>
      {sub && <div className="muted small mt-2">{sub}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="faint small">{hint}</span>}
    </div>
  );
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="between" style={{ margin: '30px 0 14px' }}>
      <div>
        <h3 style={{ fontSize: 18 }}>{title}</h3>
        {sub && <div className="muted small mt-2">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs">
      {options.map((o) => (
        <button key={o.value} className={`tab ${value === o.value ? 'active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
