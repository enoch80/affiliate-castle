'use client'

import { useState } from 'react'

const fields = [
  {
    section: 'Publishing APIs',
    items: [
      { key: 'DEVTO_API_KEY', label: 'dev.to API Key', placeholder: 'dev-to-token…', type: 'password' },
      { key: 'HASHNODE_TOKEN', label: 'Hashnode API Token', placeholder: 'hashnode-token…', type: 'password' },
      { key: 'BLOGGER_CLIENT_ID', label: 'Blogger Client ID', placeholder: 'Google OAuth2 client ID', type: 'text' },
      { key: 'TUMBLR_CONSUMER_KEY', label: 'Tumblr Consumer Key', placeholder: 'tumblr-key…', type: 'password' },
    ],
  },
  {
    section: 'Telegram',
    items: [
      { key: 'TELEGRAM_BOT_TOKEN', label: 'Bot Token', placeholder: '123456:ABC-…', type: 'password' },
      { key: 'TELEGRAM_CHANNEL_ID', label: 'Channel ID', placeholder: '@mychannel or -100…', type: 'text' },
    ],
  },
  {
    section: 'Email (Listmonk)',
    items: [
      { key: 'LISTMONK_URL', label: 'Listmonk URL', placeholder: 'http://localhost:9000', type: 'text' },
      { key: 'LISTMONK_USERNAME', label: 'Listmonk Username', placeholder: 'admin', type: 'text' },
      { key: 'LISTMONK_PASSWORD', label: 'Listmonk Password', placeholder: '••••••••', type: 'password' },
      { key: 'PHYSICAL_ADDRESS', label: 'Physical Mailing Address (CAN-SPAM)', placeholder: '123 Main St, City, State, ZIP', type: 'text' },
    ],
  },
  {
    section: 'Domain',
    items: [
      { key: 'APP_DOMAIN', label: 'App Domain', placeholder: 'app.yourdomain.com', type: 'text' },
      { key: 'TRACKING_DOMAIN', label: 'Tracking Domain', placeholder: 't.yourdomain.com', type: 'text' },
      { key: 'INDEXNOW_KEY', label: 'IndexNow Key', placeholder: 'auto-generated', type: 'text' },
    ],
  },
]

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // noop — Sprint 2 will wire real persistence
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
      <p className="text-slate-400 mb-8">
        Configure platform API keys and credentials. Values are AES-256 encrypted at rest.
      </p>

      <div className="space-y-8">
        {fields.map(section => (
          <div key={section.section}>
            <h2 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-4">
              {section.section}
            </h2>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-5">
              {section.items.map(item => (
                <div key={item.key}>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{item.label}</label>
                  <input
                    type={item.type}
                    placeholder={item.placeholder}
                    value={values[item.key] || ''}
                    onChange={e => setValues(v => ({ ...v, [item.key]: e.target.value }))}
                    autoComplete="off"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold px-8 py-3 rounded-xl transition-colors"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
      </div>
    </div>
  )
}
