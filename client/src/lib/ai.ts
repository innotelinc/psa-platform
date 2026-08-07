// Compact client-side content engine — used only as a fallback when the API
// server is unreachable. The server hosts the full engine.
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const HOOKS = ['STOP SCROLLING. 👀', 'This one’s for you.', 'You’re going to want to save this.', 'Hold on to your phone 📱', 'Plot twist: I actually did the thing.'];
const BODIES = (t: string, p: string) => [
  `${p ? p.trim() + ' — ' : ''}built for people who care about ${t || 'real results'}. No fluff, just momentum.`,
  `I’ve been working on ${t || 'this'} for a while, and today I’m finally sharing it. Consistency wins.`,
  `The honest truth about ${t || 'growth'}: it’s simpler than it looks. Show up daily, stay authentic.`,
];
const CTAS = ['Follow for more 🔥', 'Double tap if you agree 💜', 'Share this with someone who needs it', 'Drop a comment below 👇'];
const TAGS = ['growth', 'mindset', 'buildinpublic', 'success', 'motivation', 'viral', 'foryou', 'newchapter', 'hustle', 'createeveryday'];

export function fallbackPost(opts: any = {}) {
  const { topic = '', product = '', platform = 'instagram', tone = 'hype', length = 'medium' } = opts;
  const body = pick(BODIES(topic, product));
  const text = `${pick(HOOKS)}\n\n${body}\n\n${pick(CTAS)}`;
  const extra = platform === 'tiktok' ? ' #fyp' : '';
  const words = topic.split(/\s+/).filter(Boolean).slice(0, 3).map((w: string) => '#' + w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
  const tags = [...new Set([...words, ...TAGS])].slice(0, 10).map((t) => '#' + t.replace(/^#/, ''));
  return {
    text: (length === 'short' ? text.slice(0, 240) : length === 'long' ? text + '\n\nSave this for later. Consistency compounds.' : text) + extra,
    hashtags: tags,
    headline: `Why Everyone Is Wrong About ${topic || 'This'}`,
    tone, type: opts.type || 'promo', platform,
    createdAt: Date.now(),
  };
}

export function fallbackBio(platform: string, profile: any = {}) {
  const h = profile.headline || 'Building something big';
  const a = profile.about || '';
  if (platform === 'linkedin') return { text: `${h} — ${a.slice(0, 90)}\n\nOpen to opportunities. Let’s connect.` };
  if (platform === 'indeed') return { text: `${h}. ${a.slice(0, 120)}\n\nCore strengths: execution, communication, follow-through.` };
  return { text: `${h} 🔥 ${a.slice(0, 90)}` };
}

export function fallbackHeadlines(topic: string, count = 5) {
  const t = topic || 'This';
  const list = [
    `${t}: The Truth Nobody Wants to Admit`,
    `I Tried ${t} for 30 Days — Here’s What Happened`,
    `Why Everyone Is Wrong About ${t}`,
    `The ${t} Secret Nobody Talks About`,
    `How to Master ${t} (A Simple Framework)`,
    `Stop Ignoring ${t}. Start Here.`,
    `POV: You Finally Took ${t} Seriously`,
    `What Nobody Tells You About ${t}`,
  ];
  return list.slice(0, count);
}
