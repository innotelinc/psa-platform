# 🚀 PSA Platform — Personal Social Assistant

> **Your AI-powered fame machine.** Post to every social platform on autopilot, keep your professional profiles fresh, auto-generate resumes, and publish a personal website — all from one dashboard.

<p align="center">
  <img src="https://img.shields.io/badge/status-active-brightgreen" alt="Status">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-purple" alt="License">
</p>

---

## ✨ Features

### 📱 Social Media Command Center
- **12 platforms supported** — Instagram, TikTok, X (Twitter), Facebook, YouTube, Snapchat, Threads, Pinterest, LinkedIn, Indeed, Personal Website, Resume
- **One-click connect** via real OAuth 2.0 for 8 platforms (X, LinkedIn, Facebook, Instagram, Threads, YouTube, Pinterest, TikTok)
- **Bulk posting** — write once, publish everywhere simultaneously
- **Channel toggles** — enable/disable platforms with a single click

### 🤖 AI Content Engine
- **12 tone profiles** — hype, witty, professional, casual, viral, inspirational, educational, controversial, relatable, urgent, luxurious, minimalist
- **11 post styles** — promo, hook, tip, story, question, listicle, hot-take, testimonial, behind-the-scenes, tutorial, comparison
- **Auto-generate bios** per platform (LinkedIn professional, TikTok casual, Instagram aesthetic, etc.)
- **Headline generator** — scroll-stopping clickbait that converts
- **Optional real AI** — plug in your own OpenAI/Claude API key for GPT-4-powered generation

### 📅 Campaign Autopilot
- **Recurring schedules** — daily, weekly, bi-weekly, monthly
- **Auto-pilot mode** — AI generates + posts on your schedule
- **Multi-channel targeting** — pick which platforms each campaign hits
- **15-second scheduler** — campaigns fire automatically while the server runs
- **Run-now** — trigger a campaign manually at any time

### 👤 Profile Hub
- **AI bios** — generate platform-optimized bios for LinkedIn, Instagram, TikTok, X, etc.
- **AI about me** — generate professional summaries tuned to your brand voice
- **Avatar studio** — placeholder with image upload support
- **Career manager** — track experience, education, skills, services

### 📄 Resume Builder
- **3 templates** — Modern, Minimal, Bold
- **Live preview** — see changes in real-time
- **Section toggles** — show/hide experience, education, skills, certifications
- **HTML download** — export as a standalone HTML file
- **Print-optimized** — professional print stylesheet included

### 🌐 Personal Website
- **Hero + CTA builder** — build your landing page
- **Custom sections** — add testimonials, pricing, portfolio, etc.
- **Live preview** with instant publish
- **Standalone HTML export** — download the full site as a single file
- **Social links** — auto-populated from connected platforms

### 📊 Dashboard & Analytics
- **Fame Score™** — proprietary 0-100 score tracking your brand growth
- **Growth charts** — follower + engagement trends over time
- **Activity feed** — every post, campaign, and profile update logged
- **Audience breakdown** — per-platform follower counts
- **Upcoming posts** — scheduled content queue at a glance

---

## 🏗 Architecture

```
psa-platform/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/        # ui.tsx, charts.tsx
│   │   ├── lib/               # api.ts, store.tsx, types.ts, ai.ts, platforms.tsx
│   │   ├── pages/             # Login, Dashboard, Campaigns, Composer,
│   │   │                      # ProfileHub, Resume, Website, Settings, PublicSite
│   │   ├── App.tsx            # React Router setup
│   │   ├── main.tsx           # Entry point + Error Boundary
│   │   └── styles.css         # Full design system (19KB)
│   ├── vite.config.ts         # Dev server + API proxy
│   └── package.json
├── server/                    # Express REST API
│   ├── index.js               # Routes: auth, state, channels, OAuth, campaigns, posts, AI
│   ├── aiEngine.js            # Built-in content generator (12 tones × 11 styles)
│   ├── oauth.js               # Unified OAuth 2.0 PKCE handler
│   ├── postEngine.js          # Real API posting + simulation fallback
│   ├── store.js               # JSON file persistence
│   ├── platforms/             # Per-platform API configs
│   │   └── index.js           # X, LinkedIn, Facebook, Instagram, Threads, YouTube, Pinterest, TikTok
│   └── package.json
├── scripts/
│   └── dev.mjs                # Concurrent dev launcher
├── Dockerfile                 # Multi-stage production build
├── .dockerignore
└── package.json               # Root orchestrator
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+**
- **npm 9+**

### Install & Run

```bash
# Clone the repo
git clone https://github.com/innotelinc/psa-platform.git
cd psa-platform

# Install all dependencies
npm run install:all

# Start dev mode (server :3001 + client :5173)
npm run dev
```

Open **http://localhost:5173** and register an account.

### Docker (Production)

```bash
docker build -t psa-platform .
docker run -d -p 3001:3001 psa-platform
```

Open **http://localhost:3001** — everything runs in a single container.

---

## 🔐 Setting Up Real Platform APIs

1. Go to **Settings → Platform API Keys**
2. Create a developer app on each platform's portal (links provided in-app)
3. Paste the Client ID + Secret
4. Go to **Dashboard**, click **Connect** on a platform
5. Authorize via OAuth popup — your posts now go live!

| Platform | API Support | Notes |
|---|---|---|
| X (Twitter) | ✅ OAuth 2.0 PKCE | Free tier, ~$0.015/post |
| LinkedIn | ✅ OAuth 2.0 | Needs company page |
| Facebook | ✅ OAuth 2.0 | Needs Facebook Page |
| Instagram | ⚠️ Media only | Business account required |
| Threads | ✅ OAuth 2.0 | Meta's newest API |
| YouTube | ⚠️ Media only | Google OAuth |
| Pinterest | ⚠️ Needs media+link | Board ID required |
| TikTok | ⚠️ Video only | Needs formal audit |
| Snapchat | ❌ Simulation | No public posting API |
| Indeed | ❌ Simulation | No status update API |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router, Lucide Icons |
| Backend | Node.js, Express, scrypt auth |
| AI | Built-in engine + optional OpenAI/Claude API |
| Auth | OAuth 2.0 PKCE (8 platforms) |
| Storage | JSON file persistence |
| Container | Docker multi-stage build |

---

## 📄 License

MIT © [Darnel Hunter](https://github.com/innotelinc)

---

<p align="center">
  <b>Built with 🔥 by <a href="https://github.com/innotelinc">innotelinc</a></b>
</p>
