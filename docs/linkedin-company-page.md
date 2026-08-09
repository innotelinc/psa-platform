# 🏢 Innotel — LinkedIn Company Page Kit

Everything you need to create and launch Innotel's Company Page on LinkedIn, plus how to point this app at it so your scheduled posts go out **as the company page** instead of a personal profile.

---

## 1️⃣ Create the page (5 minutes, in the browser)

1. Sign in to LinkedIn with an account that will be a **page admin**.
2. Go to **https://www.linkedin.com/company/setup/** (or click the `Me` menu → **Create a Company Page+**).
3. Choose **Company** (not *Showcase page* or *Educational institution*).
4. Fill in the basics from the kit below → **Create page**.
5. Add branding:
   - **Logo** — 300×300 px PNG (square, on a solid or transparent background).
   - **Cover image** — 1584×396 px (e.g., your server rack / open-source motif with the tagline).
6. Paste the **About** text and add **Specialties** under the *About* tab.
7. Add your location (Springfield, MA) and any **admins** (Settings → Admin roles).
8. Publish your **first post** (starter ideas below), then **follow the page** from your personal account.

> ⚠️ LinkedIn reviews new pages; the "followers" button and full features unlock after a short verification window.

---

## 2️⃣ Copy kit

### Page name
**Innotel**

### Tagline (≤ 120 chars)
```
Open-source IT infrastructure, VoIP telephony & email collaboration that just works.
```

### About (≤ 2,000 chars)
```
Innotel is an IT infrastructure and systems integration company based in Springfield, Massachusetts. We design, deploy, and maintain the open-source systems that keep modern organizations connected — from Linux server administration and Docker-based hosting to enterprise-grade VoIP telephony and PBX solutions.

Innotel has been a trusted name in the open-source community, publishing installation guides, custom builds, and package repositories used by administrators worldwide. Our work spans Zimbra email collaboration hosting, Asterisk/FreePBX telephony, fax and document delivery, and the networking that ties it all together.

What we believe:
• Open source is an advantage, not a compromise.
• Systems should be boring in the best way — reliable, secure, and quiet.
• Every deployment deserves documentation, monitoring, and a human who answers.

Whether you need a resilient email platform, a modern phone system, or a server fleet you can actually trust, Innotel builds it, runs it, and stands behind it.
```

### Specialties
```
Linux & open-source server administration
VoIP / PBX / Asterisk / FreePBX
Zimbra email collaboration hosting
Fax & document delivery (HylaFAX, AvantFax)
Docker & self-hosted infrastructure
Systems integration
Network security & monitoring
Ubuntu engineering
```

### Company details
| Field | Value |
|---|---|
| Website | `https://innotel.us` |
| Industry | IT Services and IT Consulting |
| Company size | 1–10 employees |
| Headquarters | Springfield, Massachusetts |

### First 5 posts (paste-ready)
1. **Launch:** *Innotel is officially on LinkedIn! We build and run the open-source infrastructure behind modern organizations — email, telephony, servers, and the people who keep them humming. Follow along for behind-the-scenes, guides, and honest ops talk. 🚀*
2. **Zimbra spotlight:** *Hosting Zimbra for 10 years taught us one thing: email is the last system anyone wants to think about. We make it boring — in the best way. 99.9% uptime, zero surprises.*
3. **VoIP tip:** *Your phone system shouldn't hold your business hostage. We deploy Asterisk/FreePBX with automatic failover so a cut cable never means a silent office. ☎️*
4. **Behind the scenes:** *Here's a recent build: a full Zimbra + VoIP stack on Ubuntu, monitored, documented, and shipped in under a week. This is what "done" looks like. 📦*
5. **Philosophy:** *We believe open source is an advantage, not a compromise. Every system we deploy is auditable, portable, and free of vendor lock-in. Your infrastructure should belong to you.*

---

## 3️⃣ Connect the page to this app

The app can now post to a **LinkedIn Company Page** as well as a personal profile. Setup:

1. **LinkedIn developer app** — in the [LinkedIn Developer Portal](https://www.linkedin.com/developers), make sure your app has the **Community Management API** product (grants the `w_organization_social` scope). Add the redirect URI:
   ```
   https://psa.innotel.us/api/oauth/linkedin/callback
   ```
2. **App settings** — Settings → Platform API keys → paste your LinkedIn **Client ID / Client Secret**.
3. **Enable Company Page posting** — Settings → LinkedIn → toggle **Company Page posting → on**. The `w_organization_social` scope is only requested once this is on, so plain LinkedIn OAuth keeps working even if the product isn't enabled.
4. **Connect** — Dashboard → LinkedIn → Connect → authorize (approve the new *organization* scope this time).
5. **Pick the page** — Settings → LinkedIn → **Post as** → select **🏢 Innotel**. Your scheduled posts now publish on the Innotel page.
6. Hit **Sync** any time to refresh the page list or add new pages you administer.

> 🔁 Connected before enabling the toggle? Disconnect LinkedIn and re-connect once so the token includes the new `w_organization_social` scope.

**How it works under the hood**
- OAuth requests `w_organization_social` (in addition to `w_member_social`) only when **Company Page posting** is enabled — requesting an unprovisioned scope would make LinkedIn reject the whole authorization.
- After OAuth, the server lists pages you administer via `organizationalEntityAcls` and stores them in your LinkedIn credentials (`extra.linkedinOrgPages`).
- The "Post as" picker stores your choice in `extra.orgId`. When set, posts are authored as `urn:li:organization:{id}` instead of `urn:li:person:{id}`.
