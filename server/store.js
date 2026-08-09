// FameForge persistent store — JSON-file backed, in-memory fast-path.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const DB_FILE = join(DATA_DIR, 'db.json');
const IN_MEMORY = process.env.DB_IN_MEMORY === '1';

export const PLATFORMS = [
  { id: 'instagram', name: 'Instagram', category: 'social', color: '#E1306C', glow: '#ff2d78', handleType: '@handle', charLimit: 2200, emoji: '📸' },
  { id: 'tiktok', name: 'TikTok', category: 'social', color: '#25F4EE', glow: '#fe2c55', handleType: '@handle', charLimit: 2200, emoji: '🎵' },
  { id: 'x', name: 'X / Twitter', category: 'social', color: '#e7e9ea', glow: '#94a3b8', handleType: '@handle', charLimit: 280, emoji: '✖️' },
  { id: 'facebook', name: 'Facebook', category: 'social', color: '#1877F2', glow: '#1877f2', handleType: '/page', charLimit: 63206, emoji: '👍' },
  { id: 'youtube', name: 'YouTube', category: 'social', color: '#FF0000', glow: '#ff0000', handleType: '/channel', charLimit: 5000, emoji: '▶️' },
  { id: 'snapchat', name: 'Snapchat', category: 'social', color: '#FFFC00', glow: '#ffd60a', handleType: '@username', charLimit: 250, emoji: '👻' },
  { id: 'threads', name: 'Threads', category: 'social', color: '#f5f5f5', glow: '#c084fc', handleType: '@handle', charLimit: 500, emoji: '🧵' },
  { id: 'pinterest', name: 'Pinterest', category: 'social', color: '#E60023', glow: '#e60023', handleType: '/user', charLimit: 500, emoji: '📌' },
  { id: 'linkedin', name: 'LinkedIn', category: 'professional', color: '#0A66C2', glow: '#0a66c2', handleType: '/in/name', charLimit: 3000, emoji: '💼' },
  { id: 'indeed', name: 'Indeed', category: 'professional', color: '#2557A7', glow: '#3b82f6', handleType: '/profile', charLimit: 4000, emoji: '🔍' },
  { id: 'website', name: 'Personal Website', category: 'hub', color: '#a855f7', glow: '#a855f7', handleType: 'URL', charLimit: 99999, emoji: '🌐' },
  { id: 'resume', name: 'Resume / Portfolio', category: 'hub', color: '#ff2d78', glow: '#ff2d78', handleType: 'PDF', charLimit: 99999, emoji: '📄' },
];

export function defaultChannels() {
  return PLATFORMS.map((p, i) => ({
    id: p.id,
    enabled: true,
    connected: false,
    handle: '',
    followers: 0,
    posts: 0,
  }));
}

export function defaultState(name, email) {
  return {
    email,
    name,
    channels: defaultChannels(),
    profile: {
      name,
      headline: '',
      about: '',
      location: '',
      email,
      phone: '',
      website: '',
      avatar: { style: 'gradient', from: '#ff2d78', to: '#a855f7', emoji: '🔥', label: (name || 'F').slice(0, 2).toUpperCase() },
      skills: [],
      experience: [],
      education: [],
      services: [],
    },
    resume: {
      template: 'modern',
      accent: '#ff2d78',
      targetRole: '',
      summary: '',
      sections: { summary: true, skills: true, experience: true, education: true, services: true, socials: true },
    },
    site: {
      theme: 'dark',
      accent: '#ff2d78',
      headline: '',
      subheadline: '',
      slug: '',
      published: false,
      ctaText: 'Work With Me',
      ctaLink: '',
      sections: { hero: true, about: true, services: true, socials: true, contact: true },
    },
    settings: {
      ai: { mode: 'builtin', provider: 'openai', apiKey: '', baseUrl: '', model: '' },
      brand: { voice: 'hype', emoji: '🔥', signature: name ? name.split(' ')[0] : 'Me' },
    },
    platformCredentials: {},
    campaigns: [],
    posts: [],
    activity: [],
    fame: { history: [] },
    createdAt: Date.now(),
  };
}

let db = null;

function load() {
  if (db) return db;
  if (IN_MEMORY) {
    db = { users: {} };
    return db;
  }
  if (existsSync(DB_FILE)) {
    try { db = JSON.parse(readFileSync(DB_FILE, 'utf8')); } catch { db = { users: {} }; }
  } else {
    db = { users: {} };
  }
  return db;
}

export function save() {
  if (IN_MEMORY) return;
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function getDB() { return load(); }
export function getUsers() { return load().users; }

export function addUser(user) {
  const d = load();
  d.users[user.id] = user;
  save();
  return user;
}

export function updateUser(id, patch) {
  const u = getUsers()[id];
  if (!u) return null;
  if (typeof patch === 'function') patch(u);
  else Object.assign(u, patch);
  save();
  return u;
}
