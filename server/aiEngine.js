// FameForge built-in AI content engine.
// Generates platform-aware, tone-tuned, click-baity content. No API key required.
// When the user configures a real AI key, index.js proxies to the provider instead.

const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length)];
const pickN = (arr, n, rnd = Math.random) => {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
  return out;
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const trim = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

// ------------------------------------------------------------------ hooks
const HOOKS = {
  hype: [
    'STOP SCROLLING. 👀', 'This is the post your feed has been waiting for.', 'You’re going to want to save this one.', 'I don’t post stuff like this often… but today we go ALL IN.',
    'Hold on to your phone. 📱', 'Warning: this might change your week.', 'Nobody is talking about this. That’s why I am.',
  ],
  pro: [
    '3 things I wish I knew sooner.', 'Here’s the honest truth about this.', 'A quick breakdown you’ll want to bookmark.',
    'In today’s post: the strategy, the results, and what I’d change.', 'Let’s talk about what actually works.',
  ],
  witty: [
    'Plot twist: I actually did the thing.', 'My therapist said talk about it. So here we are.', 'Unpopular opinion incoming…', 'I tested it so you don’t have to.',
  ],
  warm: [
    'A little story from my journey…', 'Sending this one to future me, too.', 'If this helps one person, it’s worth posting.',
    'I remember when I was exactly where you are.',
  ],
  bold: [
    'I’m done being quiet about this.', 'The take everyone’s afraid to have.', 'Straight talk: no fluff, no filter.',
    'Here’s the move most people won’t make.',
  ],
  mysterious: [
    'I can’t tell you everything… yet.', 'Something big is coming. 👀', 'This took months. You’ll see why.', 'Not ready to share all of it. Here’s a piece.',
  ],
  minimal: ['The short version.', 'Quick one.', 'Bottom line:', 'Noted and shared.'],
};

// ------------------------------------------------------------ body builders
function bodyFor(type, tone, topic, product, audience, rnd) {
  const t = topic ? topic.trim() : 'this';
  const p = product ? product.trim() : 'this';
  const aud = audience ? audience.trim() : 'your audience';
  switch (type) {
    case 'promo':
      return pick([
        `${cap(p)} is live and it was built for ${aud}. Here’s what makes it different — no fluff, just results.`,
        `I’ve been working on this for a while and I’m finally ready to show you: ${p}. If you care about ${t}, this is for you.`,
        `${cap(p)} — one tool, zero guesswork. Designed for ${aud} who want ${t} without the noise.`,
      ], rnd);
    case 'launch':
      return pick([
        `🚀 IT’S HERE. ${cap(p)} just launched and early access is open for ${aud}.`,
        `The wait is over. ${cap(p)} is officially live — built around ${t}, made for ${aud}.`,
      ], rnd);
    case 'education':
      return pick([
        `Here’s the breakdown on ${t} that took me way too long to learn: (1) it’s simpler than it looks, (2) consistency beats intensity, (3) start before you feel ready.`,
        `Quick lesson on ${t}: the people winning at this aren’t smarter — they just show up every single day.`,
      ], rnd);
    case 'behind':
      return pick([
        `Behind the scenes: this is what ${t} actually looks like before it goes public. The messy part is the real part.`,
        `POV: building ${t} at 2am because the idea wouldn’t wait. This is the unglamorous truth of the grind.`,
      ], rnd);
    case 'motivation':
      return pick([
        `You don’t need permission to go after ${t}. You need a decision. Make it today.`,
        `Nobody starts ${t} feeling ready. They start scared, they start messy — and they start anyway. So do you.`,
      ], rnd);
    case 'hook':
      return pick([
        `${cap(t)} — if you’ve ever wondered if it’s worth it, this is your sign to take it seriously.`,
        `I almost didn’t post about ${t}. Then I remembered someone out there needs to hear it.`,
      ], rnd);
    case 'engagement':
      return pick([
        `Question for ${aud}: what’s one thing about ${t} you’d love to know more about? Drop it below 👇`,
        `Be honest: when it comes to ${t}, what’s your biggest struggle? Let’s talk in the comments.`,
      ], rnd);
    case 'testimonial':
      return pick([
        `“I didn’t think ${t} was possible until I tried it.” — that’s the message I get most often about ${p}.`,
        `The best review of ${p}? People who said they’d never figure out ${t}… and then they did.`,
      ], rnd);
    case 'event':
      return pick([
        `Save the date 📅 I’m hosting something special around ${t} and you’re invited. Details dropping soon.`,
        `Live session alert! We’re going deep on ${t} — bring your questions for ${aud}.`,
      ], rnd);
    case 'tip':
      return pick([
        `3-minute tip on ${t}: start small, stay visible, and let momentum do the heavy lifting. Consistency is the cheat code.`,
        `Here’s a free tip about ${t} that most people pay to learn: the audience already wants what you’re building — show them.`,
      ], rnd);
    case 'story':
      return pick([
        `I remember the day I decided ${t} was happening. I had nothing but an idea and stubbornness. Best decision of my life.`,
        `Story time: ${t} wasn’t a straight line for me. It was a spiral — but every loop up.`,
      ], rnd);
    case 'quote':
      return pick([
        `“${cap(t)} isn’t about luck. It’s about showing up when nobody’s watching.”`,
        `Reminder for today: ${t} is a marathon, not a sprint — and you’re already further than you think.`,
      ], rnd);
    default:
      return pick([`Let’s talk about ${t}.`, `Here’s something worth your time: ${t}.`], rnd);
  }
}

const CTAS = {
  hype: ['Follow for more 🔥', 'Save this before it’s gone 👇', 'Double tap if you agree 💜', 'Share this with someone who needs it'],
  pro: ['Connect with me for more insights.', 'Bookmark this for later — you’ll thank me.', 'Let me know your thoughts in the comments.'],
  witty: ['Follow along, I’m just getting started. 😏', 'You made it this far — hit follow, don’t be shy.', 'Comment “YES” if you want part 2.'],
  warm: ['I’d love to hear your story too — comment below 💛', 'Saving this to my favorites. You should too.', 'Follow for more real talk.'],
  bold: ['Follow or miss out — your call.', 'Drop a 🔥 if you’re with me.', 'Share this. Someone needs the nudge.'],
  mysterious: ['Follow to find out what’s next 👀', 'Comment “TELL ME MORE” 👇', 'The next chapter drops soon. Stay tuned.'],
  minimal: ['Follow for more.', 'DM me for details.', 'More coming soon.'],
};

const EMOJI_MAP = {
  hype: ['🔥', '💥', '🚀', '⚡', '💰'],
  pro: ['📊', '✅', '🎯', '📈'],
  witty: ['😂', '😏', '🤌', '✨'],
  warm: ['💛', '🌱', '🙌', '🤝'],
  bold: ['👊', '🏆', '💪', '🎤'],
  mysterious: ['👀', '🔮', '🕵️', '🤫'],
  minimal: ['▪️', '—', '•'],
};

const HASHTAG_POOL = {
  general: ['growth', 'mindset', 'success', 'buildinpublic', 'hustle', 'createeveryday', 'motivation', 'winning', 'newchapter', 'goals', 'lifestyle', 'inspiration'],
  instagram: ['reels', 'explorepage', 'instagood', 'viral', 'foryou', 'instadaily', 'trending', 'reelitfeelit'],
  tiktok: ['fyp', 'foryoupage', 'viral', 'trending', 'tiktokmademebuyit', 'learnontiktok'],
  x: ['twitter', 'thread', 'hot take', 'now trending', 'startup', 'wisdom'],
  facebook: ['facebook', 'trending', 'community', 'smallbusiness', 'local'],
  youtube: ['youtube', 'subscribe', 'newvideo', 'watchnow', 'creator'],
  linkedin: ['career', 'leadership', 'personalbrand', 'growthmindset', 'opportunity', 'networking'],
  pinterest: ['ideas', 'diy', 'inspo', 'aesthetic', 'mustsave'],
  snapchat: ['snap', 'story', 'daily', 'behindthescenes'],
};

// ------------------------------------------------------------------ public API

export function generatePost(opts = {}) {
  const rnd = opts.seed ? seededRandom(opts.seed) : Math.random;
  const {
    topic = '', type = 'promo', tone = 'hype', audience = '', product = '',
    platform = 'instagram', length = 'medium', brand = { emoji: '', signature: '' }, count = 1,
  } = opts;

  const results = [];
  for (let i = 0; i < count; i++) {
    const toneActual = tone || pick(Object.keys(HOOKS), rnd);
    const hook = pick(HOOKS[toneActual] || HOOKS.hype, rnd);
    const body = bodyFor(type, toneActual, topic, product, audience, rnd);
    const cta = pick(CTAS[toneActual] || CTAS.hype, rnd);
    const emoji = pick(EMOJI_MAP[toneActual] || EMOJI_MAP.hype, rnd);
    const tags = buildHashtags(topic, platform, rnd);
    const sig = brand?.signature ? `\n\n— ${brand.signature}` : '';

    let text = `${hook}\n\n${body}\n\n${cta} ${emoji}${sig}`;
    if (platform === 'x' || length === 'short') {
      text = trim(`${hook} ${body} ${cta}`, platform === 'x' ? 270 : 420);
    } else if (length === 'long') {
      text += `\n\nSave this for when you need it. Consistency + ${topic || 'showing up'} = results.`;
    }
    results.push({
      text,
      hashtags: tags,
      tone: toneActual,
      type,
      platform,
      headline: headlineFor(topic, type, toneActual, rnd),
      createdAt: Date.now(),
    });
  }
  return count === 1 ? results[0] : results;
}

function buildHashtags(topic, platform, rnd) {
  const words = topic.split(/\s+/).filter(Boolean).map((w) => w.replace(/[^a-zA-Z0-9]/g, ''));
  const base = words.slice(0, 3).map((w) => `#${w.toLowerCase()}`);
  const pool = [...HASHTAG_POOL.general, ...(HASHTAG_POOL[platform] || [])];
  const extras = pickN(pool, Math.max(3, 8 - base.length), rnd).map((h) => `#${h.replace(/\s+/g, '').toLowerCase()}`);
  return [...new Set([...base, ...extras])].slice(0, 12);
}

export function headlineFor(topic, type, tone, rnd = Math.random) {
  const t = topic ? cap(topic.trim()) : 'This';
  const sets = {
    hype: [`${t}: The Truth Nobody Wants to Admit`, `I Tried ${t} for 30 Days — Here’s What Happened`, `Why Everyone Is Wrong About ${t}`],
    pro: [`How to Master ${t} (A Simple Framework)`, `${t}: The Strategy Behind the Success`, `What Nobody Tells You About ${t}`],
    witty: [`${t}, But Make It Honest`, `Me: “I’ll Never Do ${t}.” Also Me:`, `POV: You Finally Took ${t} Seriously`],
    bold: [`The ${t} Take Everyone Is Afraid to Have`, `Stop Ignoring ${t}. Start Here.`, `I’m Calling It: ${t} Is the Future`],
    mysterious: [`What I Learned About ${t} (That I Can’t Fully Share Yet)`, `Something Big Is Coming… and It Starts with ${t}`, `The ${t} Secret Nobody Talks About`],
  };
  const list = sets[tone] || sets.hype;
  return trim(pick(list, rnd), 90);
}

export function generateHeadlines(topic, count = 5) {
  const tones = ['hype', 'pro', 'witty', 'bold', 'mysterious', 'warm'];
  const out = [];
  for (let i = 0; i < count; i++) out.push(headlineFor(topic, 'promo', tones[i % tones.length], seededRandom(Date.now() + i)));
  return out;
}

export function generateBio(opts = {}) {
  const rnd = opts.seed ? seededRandom(opts.seed) : Math.random;
  const { platform = 'instagram', profile = {}, tone = 'hype' } = opts;
  const name = profile.name || 'Creator';
  const headline = profile.headline || 'Building something big';
  const about = profile.about || '';
  const emoji = opts.brand?.emoji || pick(EMOJI_MAP[tone] || ['🔥'], rnd);

  const byPlatform = {
    linkedin: () => {
      const lines = [
        `${headline}${about ? ' | ' + trim(about, 90) : ''}`,
        `Helping ambitious people get results — one post, project, and conversation at a time.`,
        `🔹 What I do: ${headline.toLowerCase().replace(/\.$/, '') || 'create + grow'}\n🔹 Why it matters: real progress over perfection\n🔹 Let’s connect and build.`,
      ];
      return pick(lines, rnd);
    },
    indeed: () => {
      const lines = [
        `${headline} — ${trim(about || 'Results-driven professional focused on delivering measurable impact.', 120)}\n\nCore strengths: communication, execution, and relentless follow-through. Open to new opportunities.`,
        `Professional with a track record in ${trim(about || 'delivering results', 80)}. Known for ownership, consistency, and turning ideas into outcomes.`,
      ];
      return pick(lines, rnd);
    },
    x: () => trim(`${headline} ${emoji} ${trim(about, 100)}`, 150),
    instagram: () => trim(`${headline} ${emoji}\n${trim(about, 110)}\n📍 Creator | Storyteller`, 220),
    tiktok: () => trim(`${headline} ${emoji}\n${trim(about, 90)}`, 150),
    facebook: () => `${headline}\n\n${trim(about || 'Welcome! This is where I share the journey.', 200)}`,
    youtube: () => `${headline} ${emoji}\n${trim(about, 180)}\nNew content weekly. Subscribe & join the journey.`,
    default: () => trim(`${headline} ${emoji} — ${trim(about, 120)}`, 220),
  };
  return { text: (byPlatform[platform] || byPlatform.default)() };
}

export function generateAbout(profile = {}, tone = 'professional') {
  const name = profile.name || 'Your Name';
  const headline = profile.headline || 'a creator & builder';
  const about = profile.about || '';
  const skills = profile.skills || [];
  const skillLine = skills.length ? skills.slice(0, 4).join(', ') : 'consistency, creativity, and results';
  const base = about || `I’m ${name} — ${headline}. I turn ideas into momentum and momentum into results.`;

  if (tone === 'hype') {
    return `I’m ${name}, and I build things that move. ${cap(headline)} — I live by three rules: show up daily, stay authentic, and never stop learning.\n\n${base}\n\nWhat I bring: ${skillLine}. When I’m not creating, I’m planning the next big move. Let’s make something unforgettable. ${profile.website ? 'Connect with me at ' + profile.website + '.' : ''}`;
  }
  if (tone === 'minimal') {
    return `${cap(headline)}. ${base} Focus: ${skillLine}. Based in ${profile.location || 'the internet'}. Let’s connect: ${profile.email || 'email me'}.`;
  }
  return `${name} is ${headline}. With a focus on ${skillLine}, ${name} helps people and brands achieve measurable outcomes through authentic storytelling and relentless execution. ${base}\n\nOpen to collaborations, partnerships, and new opportunities.`;
}

export function generatePostIdeas(topic, audience, count = 6) {
  const types = ['promo', 'education', 'behind', 'motivation', 'engagement', 'hook', 'tip', 'story', 'event', 'testimonial'];
  const out = [];
  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    out.push({ type, title: headlineFor(topic, type, 'hype', seededRandom(Date.now() + i * 7)), preview: bodyFor(type, 'hype', topic, '', audience, seededRandom(Date.now() + i * 13)) });
  }
  return out;
}

// deterministic pseudo-random for stable "AI" output with a seed
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
