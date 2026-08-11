import { useState } from 'react';
import { KeyRound, Sparkles, Trash2, Save, Bot, Check, Link2, ExternalLink, Lock, Loader2, Info, RefreshCw, Building2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { Btn, Field, Chip, PlatGlyph } from '../components/ui';
import { platName } from '../lib/platforms';

// Per-platform extra field definitions
interface ExtraField { key: string; label: string; placeholder: string; help: string; secret?: boolean }
// Per-platform primary OAuth 2.0 field labels (matches each platform's developer portal terminology)
const OAUTH_FIELD_NAMES: Record<string, [string, string]> = {
  x:         ['Client ID', 'Client Secret'],
  linkedin:  ['Client ID', 'Client Secret'],
  facebook:  ['App ID', 'App Secret'],
  instagram: ['App ID', 'App Secret'],
  threads:   ['App ID', 'App Secret'],
  youtube:   ['Client ID', 'Client Secret'],
  pinterest: ['App ID', 'App Secret key'],
  tiktok:    ['Client Key', 'Client Secret'],
};

const EXTRA_FIELDS: Record<string, ExtraField[]> = {
  x: [
    { key: 'consumerKey', label: 'Consumer Key (API Key)', placeholder: 'From X Developer Portal — OAuth 1.0a', help: 'OAuth 1.0a Consumer Key. Use this for legacy user-key auth instead of OAuth 2.0. Generate in the X Developer Portal under Keys and Tokens.' },
    { key: 'consumerSecret', label: 'Consumer Secret (API Key Secret)', placeholder: 'From X Developer Portal — OAuth 1.0a', help: 'OAuth 1.0a Consumer Secret. Keep this private — never share it.', secret: true },
    { key: 'accessToken', label: 'Access Token', placeholder: 'Generated in X Developer Portal', help: 'OAuth 1.0a Access Token. Generate via the X Developer Portal for your app under "Authentication Tokens".' },
    { key: 'accessTokenSecret', label: 'Access Token Secret', placeholder: 'Generated in X Developer Portal', help: 'OAuth 1.0a Access Token Secret. Generate alongside the Access Token in the X Developer Portal.', secret: true },
  ],
  facebook: [
    { key: 'pageId', label: 'Facebook Page ID', placeholder: 'e.g. 1234567890', help: 'The numeric ID of the Facebook Page to post to. Find it in Page Settings → Page Transparency.' },
    { key: 'pageToken', label: 'Page Access Token', placeholder: '(auto-fetched after OAuth)', help: 'Auto-populated after OAuth. Only set manually if the auto-fetch fails.', secret: true },
  ],
  instagram: [
    { key: 'igUserId', label: 'Instagram Business Account ID', placeholder: 'e.g. 17841400000000000', help: 'The numeric IG Business Account ID. Find it in Facebook Business Settings → Instagram Accounts, or auto-fetched after connecting Facebook.' },
  ],
  threads: [
    { key: 'threadsUserId', label: 'Threads User ID', placeholder: 'e.g. 1234567890', help: 'Your numeric Threads user ID. After OAuth, this is your Threads profile ID.' },
  ],
  pinterest: [
    { key: 'boardId', label: 'Pinterest Board ID', placeholder: 'e.g. 1234567890', help: 'The numeric ID of the board to pin to. Find it in the board URL or auto-fetched after OAuth.' },
  ],
};

export default function Settings() {
  const { user, refresh, toast, logout } = useStore();
  const [draftAi, setDraftAi] = useState<any>(null);
  const [draftBrand, setDraftBrand] = useState<any>(null);
  const [draftPlatforms, setDraftPlatforms] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [changingPw, setChangingPw] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPwForm, setShowPwForm] = useState(false);

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
                const storedExtra = creds?.extra || {};
                const draft = draftPlatforms[pid] || { clientId: '', clientSecret: '', extra: {} };
                const extraFields = EXTRA_FIELDS[pid] || [];
                const configured = creds?.configured;
                // X/Twitter: supports both OAuth 1.0a (legacy) and OAuth 2.0
                const isX = pid === 'x';
                const hasOAuth1a = isX && !!(storedExtra.consumerKey && storedExtra.accessToken);
                const hasDraft = draft.clientId || draft.clientSecret || extraFields.some((f) => f.key in (draft.extra || {}));
                const [idLabel, secretLabel] = OAUTH_FIELD_NAMES[pid] || ['Client ID', 'Client Secret'];
                // LinkedIn Company Page posting is opt-in (needs the w_organization_social scope).
                // Legacy users who already have pages stored count as enabled.
                const orgEnabled = pid === 'linkedin' && (storedExtra.enableOrgPosting === true || (storedExtra.linkedinOrgPages?.length || 0) > 0);
                return (
                  <div key={pid} style={{ background: 'var(--panel)', border: `1px solid ${configured ? 'rgba(52,211,153,0.35)' : 'var(--stroke)'}`, borderRadius: 14, padding: 16 }}>
                    <div className="between">
                      <div className="row" style={{ gap: 10 }}>
                        <PlatGlyph id={pid} size={15} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{platName(pid)}</div>
                          <div className="faint small mt-1">
                            {configured ? (
                              isX ? (
                                hasOAuth1a ? (
                                  <span style={{ color: 'var(--green)' }}>✅ OAuth 1.0a configured & ready</span>
                                ) : (
                                  <span style={{ color: 'var(--green)' }}>✅ OAuth 2.0 configured & ready</span>
                                )
                              ) : (
                                <span style={{ color: 'var(--green)' }}>✅ Configured & ready</span>
                              )
                            ) : (
                              <span>{hasDraft ? '⚠️ Unsaved changes' : 'No credentials set — simulated mode'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        {configured && (
                          <button className="btn ghost sm" style={{ fontSize: 11 }} onClick={async () => {
                            // X: clear OAuth 1.0a extra fields; other platforms: clear clientId/clientSecret.
                            // replaceExtra:true makes the server replace (not merge) the extra object.
                            await api.savePlatformCredentials(pid, { clientId: '', clientSecret: '', extra: isX ? {} : storedExtra, replaceExtra: true });
                            setDraftPlatforms((p) => { const n = { ...p }; delete n[pid]; return n; });
                            await refresh();
                            toast(`Cleared ${platName(pid)} credentials`);
                          }}><Trash2 size={12} /></button>
                        )}
                        <button className="btn primary sm" style={{ fontSize: 11 }} disabled={savingPlatform === pid || !hasDraft} onClick={async () => {
                          setSavingPlatform(pid);
                          try {
                            const mergedExtra = { ...storedExtra, ...(draft.extra || {}) };
                            // Only send clientId/clientSecret when the user actually typed them —
                            // the server preserves stored values for omitted fields, so saving
                            // a page ID / board selection can't wipe the API credentials.
                            const payload: any = { extra: mergedExtra };
                            if (draft.clientId) payload.clientId = draft.clientId;
                            if (draft.clientSecret) payload.clientSecret = draft.clientSecret;
                            await api.savePlatformCredentials(pid, payload);
                            await refresh();
                            toast(`${platName(pid)} API credentials saved 🔑`);
                            setDraftPlatforms((p) => { const n = { ...p }; delete n[pid]; return n; });
                          } catch (e: any) { toast(e.message, 'bad'); }
                          setSavingPlatform(null);
                        }}><Save size={12} /> Save</button>
                      </div>
                    </div>
                    <div className="grid mt-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input className="input" style={{ fontSize: 12, padding: '8px 10px' }} type="password" placeholder={idLabel}
                        value={draft.clientId}
                        onChange={(e) => setDraftPlatforms((p) => ({ ...p, [pid]: { ...(p[pid] || {}), clientId: e.target.value, extra: (p[pid] || {}).extra || draft.extra || {} } }))} />
                      <input className="input" style={{ fontSize: 12, padding: '8px 10px' }} type="password" placeholder={secretLabel}
                        value={draft.clientSecret}
                        onChange={(e) => setDraftPlatforms((p) => ({ ...p, [pid]: { ...(p[pid] || {}), clientSecret: e.target.value, extra: (p[pid] || {}).extra || draft.extra || {} } }))} />
                    </div>
                    {extraFields.length > 0 && (
                      <>
                        <div className="divider" style={{ margin: '8px 0 4px' }} />
                        {pid === 'x' && (
                          <div className="row small" style={{ gap: 4, marginBottom: 4 }}>
                            <span className="muted" style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--cyan)' }}>OAuth 1.0a Credentials</span>
                            <span className="faint" title="Paste your X Developer Portal Consumer Key & Access Token. Keys sign API requests directly — no browser popup needed." style={{ cursor: 'help' }}><Info size={10} /></span>
                          </div>
                        )}
                        {extraFields.map((ef) => (
                          <div key={ef.key} className="mt-1">
                            <div className="row small" style={{ gap: 4, marginBottom: 4 }}>
                              <span className="muted" style={{ fontSize: 11 }}>{ef.label}</span>
                              <span className="faint" title={ef.help} style={{ cursor: 'help' }}><Info size={10} /></span>
                            </div>
                            <input
                              className="input"
                              style={{ fontSize: 12, padding: '8px 10px' }}
                              type={ef.secret ? 'password' : 'text'}
                              placeholder={ef.placeholder}
                              value={draft.extra?.[ef.key] ?? storedExtra[ef.key] ?? ''}
                              onChange={(e) => setDraftPlatforms((p) => ({
                                ...p,
                                [pid]: {
                                  ...(p[pid] || { clientId: '', clientSecret: '' }),
                                  extra: { ...((p[pid] || {}).extra || storedExtra), [ef.key]: e.target.value },
                                },
                              }))}
                            />
                          </div>
                        ))}
                      </>
                    )}
                    {pid === 'linkedin' && configured && (
                      <>
                        <div className="divider" style={{ margin: '8px 0 4px' }} />
                        <div className="row mt-1" style={{ gap: 10, alignItems: 'center' }}>
                          <button
                            className={`chip ${orgEnabled ? 'grad' : ''}`}
                            style={{ cursor: 'pointer', padding: '8px 14px', fontSize: 12, whiteSpace: 'nowrap' }}
                            onClick={async () => {
                              try {
                                if (orgEnabled) {
                                  await api.setPlatformExtra('linkedin', { enableOrgPosting: false, orgId: '', linkedinOrgPages: [] });
                                  await refresh();
                                  toast('Company Page posting off — posts go out as your profile 👤');
                                } else {
                                  await api.setPlatformExtra('linkedin', { enableOrgPosting: true });
                                  await refresh();
                                  toast('Company Page posting on — disconnect & re-connect LinkedIn to grant the scope 🔐');
                                }
                              } catch (e: any) { toast(e.message, 'bad'); }
                            }}
                          >
                            {orgEnabled ? <Check size={12} /> : <Building2 size={12} />} Company Page posting {orgEnabled ? 'on' : 'off'}
                          </button>
                          <span className="faint small" style={{ fontSize: 10.5, lineHeight: 1.5 }} title="Requires the Community Management API product in your LinkedIn app (Developer Portal → Products). After enabling, disconnect & re-connect LinkedIn to re-authorize with the extra scope.">
                            <Info size={10} style={{ verticalAlign: -1 }} /> Needs the Community Management API product; re-connect LinkedIn after enabling.
                          </span>
                        </div>
                        {orgEnabled && (
                          <div className="mt-1">
                          <div className="row small" style={{ gap: 4, marginBottom: 4 }}>
                            <span className="muted" style={{ fontSize: 11 }}>Post as</span>
                            <span className="faint" title="LinkedIn posts go out from your personal profile, or from a Company Page you administer (needs the w_organization_social scope)." style={{ cursor: 'help' }}><Info size={10} /></span>
                          </div>
                          <div className="row" style={{ gap: 8 }}>
                            {(storedExtra.linkedinOrgPages?.length || 0) > 0 ? (
                              <select
                                className="select"
                                style={{ fontSize: 12, padding: '8px 10px', flex: 1 }}
                                value={storedExtra.orgId || ''}
                                onChange={async (e) => {
                                  try {
                                    // '' = personal profile. Send the empty string so the key survives JSON serialization
                                    // (undefined would be dropped and the server would keep the previous orgId).
                                    const orgId = e.target.value || '';
                                    await api.setPlatformExtra('linkedin', { ...storedExtra, orgId });
                                    await refresh();
                                    const page = storedExtra.linkedinOrgPages?.find((p: any) => p.id === orgId);
                                    toast(orgId ? `LinkedIn posts will go out as ${page ? '“' + page.name + '”' : 'your company page'} 🏢` : 'LinkedIn posts will go out as your personal profile 👤');
                                  } catch (err: any) { toast(err.message, 'bad'); }
                                }}
                              >
                                <option value="">👤 Personal profile</option>
                                {storedExtra.linkedinOrgPages?.map((pg: any) => (
                                  <option key={pg.id} value={pg.id}>🏢 {pg.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="faint small" style={{ fontSize: 11, lineHeight: 1.5, flex: 1 }}>
                                No Company Pages found yet. Create/admin a page on LinkedIn, then hit Sync. (If you connected before, disconnect & re-connect to grant the w_organization_social scope.)
                              </span>
                            )}
                            <button className="btn ghost sm" style={{ fontSize: 11, whiteSpace: 'nowrap' }} onClick={async () => {
                              try {
                                await api.oauthAutoConfigure('linkedin');
                                await refresh();
                                toast('LinkedIn profile & pages re-synced 🔄');
                              } catch (e: any) { toast(e.message, 'bad'); }
                            }}><RefreshCw size={11} /> Sync</button>
                          </div>
                          </div>
                        )}
                      </>
                    )}
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
                🔒 Credentials are stored encrypted in your local server data. The OAuth redirect URI is <code style={{ background: 'rgba(255,255,255,0.07)', padding: '2px 6px', borderRadius: 5 }}>https://psa.innotel.us/api/oauth/&#123;platform&#125;/callback</code> — add this to each platform's allowed redirect URIs.
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
          </div>

          <div className="card">
            <div className="card-title"><Lock size={16} style={{ color: 'var(--cyan)' }} /> Change password</div>
            <div className="card-sub">Set a new password for your account.</div>
            {!showPwForm ? (
              <Btn variant="ghost" className="mt-3" onClick={() => setShowPwForm(true)}>
                <Lock size={14} /> Change your password
              </Btn>
            ) : (
              <form
                className="col mt-3"
                style={{ gap: 12 }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (newPassword.length < 6) { toast('Password must be at least 6 characters', 'bad'); return; }
                  setChangingPw(true);
                  try {
                    await api.changePassword(currentPassword, newPassword);
                    toast('Password changed! 🔐');
                    setCurrentPassword('');
                    setNewPassword('');
                    setShowPwForm(false);
                  } catch (err: any) {
                    toast(err.message || 'Something went wrong', 'bad');
                  } finally {
                    setChangingPw(false);
                  }
                }}
              >
                <Field label="Current password">
                  <input
                    className="input"
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </Field>
                <Field label="New password">
                  <input
                    className="input"
                    type="password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </Field>
                <div className="row" style={{ gap: 8 }}>
                  <Btn type="submit" variant="primary" disabled={changingPw}>
                    {changingPw ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
                    {changingPw ? 'Changing…' : 'Update password'}
                  </Btn>
                  <Btn type="button" variant="ghost" onClick={() => { setShowPwForm(false); setCurrentPassword(''); setNewPassword(''); }}>
                    Cancel
                  </Btn>
                </div>
              </form>
            )}
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
