import {
  Instagram, Music2, Twitter, Facebook, Youtube, Ghost, AtSign, Pin, Linkedin, Search, Globe, FileText, type LucideIcon,
} from 'lucide-react';
import type { Channel } from './types';

export interface PlatformDef {
  id: string;
  name: string;
  category: 'social' | 'professional' | 'hub';
  color: string;
  handleType: string;
  charLimit: number;
  icon: LucideIcon;
  emoji: string;
}

export const PLATFORMS: PlatformDef[] = [
  { id: 'instagram', name: 'Instagram', category: 'social', color: '#E1306C', handleType: '@handle', charLimit: 2200, icon: Instagram, emoji: '📸' },
  { id: 'tiktok', name: 'TikTok', category: 'social', color: '#25F4EE', handleType: '@handle', charLimit: 2200, icon: Music2, emoji: '🎵' },
  { id: 'x', name: 'X / Twitter', category: 'social', color: '#e7e9ea', handleType: '@handle', charLimit: 280, icon: Twitter, emoji: '✖️' },
  { id: 'facebook', name: 'Facebook', category: 'social', color: '#1877F2', handleType: '/page', charLimit: 63206, icon: Facebook, emoji: '👍' },
  { id: 'youtube', name: 'YouTube', category: 'social', color: '#FF0000', handleType: '/channel', charLimit: 5000, icon: Youtube, emoji: '▶️' },
  { id: 'snapchat', name: 'Snapchat', category: 'social', color: '#FFFC00', handleType: '@username', charLimit: 250, icon: Ghost, emoji: '👻' },
  { id: 'threads', name: 'Threads', category: 'social', color: '#f5f5f5', handleType: '@handle', charLimit: 500, icon: AtSign, emoji: '🧵' },
  { id: 'pinterest', name: 'Pinterest', category: 'social', color: '#E60023', handleType: '/user', charLimit: 500, icon: Pin, emoji: '📌' },
  { id: 'linkedin', name: 'LinkedIn', category: 'professional', color: '#0A66C2', handleType: '/in/name', charLimit: 3000, icon: Linkedin, emoji: '💼' },
  { id: 'indeed', name: 'Indeed', category: 'professional', color: '#2557A7', handleType: '/profile', charLimit: 4000, icon: Search, emoji: '🔍' },
  { id: 'website', name: 'Personal Website', category: 'hub', color: '#a855f7', handleType: 'URL', charLimit: 99999, icon: Globe, emoji: '🌐' },
  { id: 'resume', name: 'Resume / Portfolio', category: 'hub', color: '#ff2d78', handleType: 'PDF', charLimit: 99999, icon: FileText, emoji: '📄' },
];

export const plat = (id: string) => PLATFORMS.find((p) => p.id === id);
export const platName = (id: string) => plat(id)?.name || id;

export function channelStyle(ch: Channel) {
  const p = plat(ch.id);
  const base = p?.color || '#888';
  return { background: `${base}26`, color: base, border: `1px solid ${base}55` };
}

export function iconStyle(id: string) {
  const p = plat(id);
  const base = p?.color || '#888';
  return { background: `linear-gradient(135deg, ${base}, ${base}99)`, boxShadow: `0 8px 20px ${base}44` };
}

export const fmtNum = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);

export function timeAgo(ts: number | null) {
  if (!ts) return '—';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

export function fmtTime(ts: number | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
