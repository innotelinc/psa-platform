import { useState } from 'react';
import { KeyRound, Sparkles, Trash2, Save, Bot, Check, Link2, Shield, ExternalLink } from 'lucide-react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { Btn, Field, Chip, PlatGlyph } from '../components/ui';
import { platName } from '../lib/platforms';

export default function Settings() {
  const { user, refresh, toast, logout } = useStore();
  const [draftAi, setDraftAi] = useState<any>(null);
  const [draftBrand, setDraftBrand] = useState<any>(null);
  const [draftPlatforms, setDraftPlatforms] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);

  if (!user) return null;
  const ai = draftAi || user.settings.ai;
  const brand = draftBrand || user.settings.brand;

  const saveAi = async () => {
    setSaving(true);
    try {
      await api.updateState({ settings: { ai: draftAi } });
      setDraftAi(null);
      await refresh();
      toast('AI settings saved 🤖');
    } catch (e: any) { toast(e.message, 'bad'); }
    setSaving(false);
  };

  const saveBrand = async () => {
    await api.updateState({ settings: { brand: draftBrand } });
    setDraftBrand(null);
    await refresh();
    toast('Brand voice updated 🎙️');
  };

  const wipe = async () => {
    if (!confirm('Reset your account? This clears campaigns, posts and history.')) return;
    localStorage.removeItem('ff_token');
    logout();
    toast('Account data cleared');
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <div className="page-sub">Tune your fame machine.</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="col">
          <div className="card">
            <div className="card-title"><Bot size={16} style={{ color: 'var(--violet)' }} /> AI engine</div>
            <div className="card-sub">Built-in engine works instantly. Add a real API key for frontier-model generation.</div>

            <div className="field mt-4">
              <label>Generation mode</label>
              <div className="row wrap" style={{ gap: 8 }}>
                <button className={`chip ${ai.mode === 'builtin' ? 'grad' : ''}`} style={{ cursor: 'pointer', padding: '9px 16px' }} onClick={() => setDraftAi({ ...ai, mode: 'builtin' })}>
                  <Sparkles size={13} /> Built-in engine (no key)
                </button>
                <button className={`chip ${ai.mode === 'api' ? 'grad' : ''}`} style={{ cursor: 'pointer', padding: '9px 16px' }} onClick={() => setDraftAi({ ...ai, mode: 'api' })}>
                  <KeyRound size={13} /> Real AI API
                </button>
              </div>
            </div>

            {ai.mode === 'api' && (
              <>
                <Field label="Provider">
                  <select className="select" value={ai.provider} onChange={(e) => setDraftAi({ ...ai, provider: e.target.value })}>
                    <option value="openai">OpenAI (GPT-4o-mini)</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="custom">Custom (OpenAI-compatible)</option>
                  </select>
                </Field>
                <Field label="API key">
                  <input className="input" type="password" placeholder="sk-…" value={ai.apiKey} onChange={(e) => setDraftAi({ ...ai, apiKey: e.target.value })} />
                </Field>
                {ai.provider === 'custom' && (
                  <>
                    <Field label="Base URL">
                      <input className="input" placeholder="https://api.openai.com/v1" value={ai.baseUrl} onChange={(e) => setDraftAi({ ...ai, baseUrl: e.target.value })} />
                    </Field>
                    <Field label="Model">
                      <input className="input" placeholder="gpt-4o-mini" value={ai.model} onChange={(e) => setDraftAi({ ...ai, model: e.target.value })} />
                    </Field>
                  </>
                )}
                <div className="mt-3" style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: 13 }}>
                  <div className="small" style={{ lineHeight: 1.6 }}>
                    🔒 Your key is stored only in your local server data and sent directly to your chosen provider. If a call fails, FameForge automatically falls back to the built-in engine.
                  </div>
                </div>
              </>
            )}
            <Btn variant="primary" className="mt-4" onClick={saveAi} disabled={saving || !draftAi}>
              {saving ? 'Saving…' : <><Save size={15} /> Save AI settings</>}
            </Btn>
          </div>

          {/* Platform API Keys */}
          <div className="card">
            <div className="card-title"><Link2 size={16} style={{ color: 'var(--cyan)' }} /> Platform API keys</div>
            <div className="card-sub">Paste your developer app credentials to enable real posting. Get them from each platform's developer portal.</div>
            <div className="col mt-3" style={{ gap: 12 }}>
              {['x', 'linkedin', 'facebook', 'instagram', 'threads', 'youtube', 'pinterest', 'tiktok'].map((pid) => {
                const creds = user.platformCredentials?.[pid];
                const draft = draftPlatforms[pid] || { clientId: '', clientSecret: '' };
                const hasDraft = draft.clientId || draft.clientSecret;
                const configured = creds?.configured;
                return (
                  <div key={pid} style={{ background: 'var(--panel)', border: `1px solid ${configured ? 'rgba(52,211,153,0.35)' : 'var(--stroke)'}`, borderRadius: 14, padding: 16 }}>
                    <div className="between">
                      <div className="row" style={{ gap: 10 }}>
                        <PlatGlyph id={pid} size={15} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{platName(pid)}</div>
                          <div className="faint small mt-1">
                            {configured ? (
                              <span style={{ color: 'var(--green)' }}>✅ Configured & ready</span>
                            ) : (
                              <span>{hasDraft ? '⚠️ Unsaved changes' : 'No credentials set — simulated mode'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        {configured && (
                          <button className="btn ghost sm" style={{ fontSize: 11 }} onClick={async () => {
                            await api.savePlatformCredentials(pid, { clientId: '', clientSecret: '', extra: {} });
                            await refresh();
                            toast(`Cleared ${platName(pid)} credentials`);
                          }}><Trash2 size={12} /></button>
                        )}
                        <button className="btn primary sm" style={{ fontSize: 11 }} disabled={savingPlatform === pid || !hasDraft} onClick={async () => {
                          setSavingPlatform(pid);
                          try {
                            await api.savePlatformCredentials(pid, { clientId: draft.clientId, clientSecret: draft.clientSecret });
                            await refresh();
                            toast(`${platName(pid)} API credentials saved 🔑`);
                            setDraftPlatforms((p) => { const n = { ...p }; delete n[pid]; return n; });
                          } catch (e: any) { toast(e.message, 'bad'); }
                          setSavingPlatform(null);
                        }}><Save size={12} /> Save</button>
                      </div>
                    </div>
                    <div className="grid mt-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input className="input" style={{ fontSize: 12, padding: '8px 10px' }} type="password" placeholder="Client ID"
                        value={draft.clientId}
                        onChange={(e) => setDraftPlatforms((p) => ({ ...p, [pid]: { ...(p[pid] || {}), clientId: e.target.value } }))} />
                      <input className="input" style={{ fontSize: 12, padding: '8px 10px' }} type="password" placeholder="Client Secret"
                        value={draft.clientSecret}
                        onChange={(e) => setDraftPlatforms((p) => ({ ...p, [pid]: { ...(p[pid] || {}), clientSecret: e.target.value } }))} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4" style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 12, padding: 14 }}>
              <div className="small" style={{ lineHeight: 1.7 }}>
                <b className="muted">🔗 Where to get keys:</b><br />
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 6 }}>
                  <a href="https://developer.x.com" target="_blank" rel="noreferrer" className="chip" style={{ cursor: 'pointer' }}>X <ExternalLink size={10} /></a>
                  <a href="https://www.linkedin.com/developers" target="_blank" rel="noreferrer" className="chip" style={{ cursor: 'pointer' }}>LinkedIn <ExternalLink size={10} /></a>
                  <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="chip" style={{ cursor: 'pointer' }}>Meta (FB/IG/Threads) <ExternalLink size={10} /></a>
                  <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="chip" style={{ cursor: 'pointer' }}>YouTube <ExternalLink size={10} /></a>
                  <a href="https://developers.pinterest.com" target="_blank" rel="noreferrer" className="chip" style={{ cursor: 'pointer' }}>Pinterest <ExternalLink size={10} /></a>
                  <a href="https://developers.tiktok.com" target="_blank" rel="noreferrer" className="chip" style={{ cursor: 'pointer' }}>TikTok <ExternalLink size={10} /></a>
                </span>
              </div>
              <div className="faint small mt-3">
                🔒 Credentials are stored encrypted in your local server data. The OAuth redirect URI is <code style={{ background: 'rgba(255,255,255,0.07)', padding: '2px 6px', borderRadius: 5 }}>http://localhost:3000/api/oauth/&#123;platform&#125;/callback</code> — add this to each platform's allowed redirect URIs.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title"><Sparkles size={16} style={{ color: 'var(--pink)' }} /> Brand voice</div>
            <div className="card-sub">Infused into every AI post and bio.</div>
            <div className="grid mt-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Default tone">
                <select className="select" value={brand.voice} onChange={(e) => setDraftBrand({ ...brand, voice: e.target.value })}>
                  {['hype', 'pro', 'witty', 'warm', 'bold', 'mysterious', 'minimal'].map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Signature emoji">
                <input className="input" value={brand.emoji} maxLength={3} onChange={(e) => setDraftBrand({ ...brand, emoji: e.target.value })} />
              </Field>
            </div>
            <Field label="Sign-off name">
              <input className="input" value={brand.signature} onChange={(e) => setDraftBrand({ ...brand, signature: e.target.value })} />
            </Field>
            <Btn variant="gradient2" onClick={saveBrand} disabled={!draftBrand}><Check size={15} /> Save brand voice</Btn>
          </div>
        </div>

        <div className="col">
          <div className="card">
            <div className="card-title">Your account</div>
            <div className="row mt-3" style={{ gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--grad2)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18 }}>{user.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 600 }}>{user.name}</div>
                <div className="muted small">{user.email}</div>
              </div>
            </div>
            <div className="row wrap mt-4" style={{ gap: 8 }}>
              <Chip tone="green">{user.channels.filter((c) => c.connected).length} channels connected</Chip>
              <Chip tone="violet">{user.campaigns.filter((c) => c.active).length} active campaigns</Chip>
              <Chip tone="blue">{user.posts.filter((p) => p.status === 'published').length} posts published</Chip>
            </div>
            <div className="divider" />
            <div className="faint small" style={{ lineHeight: 1.7 }}>
              <b className="muted">Demo mode:</b> all platform connections and analytics are simulated locally. Real posting requires official API access from each platform (Meta, X, LinkedIn…). The integration points are built in — connect real keys to go live.
            </div>
          </div>

          <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
            <div className="card-title" style={{ color: '#f87171' }}>Danger zone</div>
            <div className="faint small mt-2">Clears local data for this browser.</div>
            <Btn variant="danger" className="mt-3" onClick={wipe}><Trash2 size={15} /> Reset account data</Btn>
          </div>

          <div className="card">
            <div className="card-title">How posting works</div>
            <div className="col small muted mt-3" style={{ lineHeight: 1.7 }}>
              <span>1️⃣ <b className="muted">Connect</b> — toggle channels & authorize on the Dashboard.</span>
              <span>2️⃣ <b className="muted">Create campaigns</b> — AI writes platform-native posts on your schedule.</span>
              <span>3️⃣ <b className="muted">Autopilot</b> — the scheduler fires at your set times; every post is logged with engagement.</span>
              <span>4️⃣ <b className="muted">Stay current</b> — LinkedIn & Indeed bios re-sync automatically when you update your profile.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
