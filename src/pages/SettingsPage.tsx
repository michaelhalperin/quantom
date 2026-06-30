import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '@/data/api'
import { useBotStore } from '@/store/useBotStore'
import { useUIStore } from '@/store/useUIStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard } from '@/components/dashboard/widgets'
import { Button, Input, SegmentedControl, Select, Slider, Switch } from '@/components/ui'

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        {description && <div className="mt-0.5 text-[11px] text-muted-2">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SettingsPage() {
  const bot = useBotStore((s) => s.botStatus)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const addToast = useUIStore((s) => s.addToast)

  const [apiUrl, setApiUrl] = useState('https://clob.polymarket.com')
  const [apiKey, setApiKey] = useState('pm_live_••••••••••••••••')
  const [network, setNetwork] = useState(bot.network)
  const [orderSize, setOrderSize] = useState('250')
  const [slippage, setSlippage] = useState(1.5)
  const [tif, setTif] = useState('GTC')
  const [confirmOrders, setConfirmOrders] = useState(true)
  const [dayLoss, setDayLoss] = useState(5)
  const [maxExposure, setMaxExposure] = useState(80)
  const [autoKill, setAutoKill] = useState(true)
  const [notif, setNotif] = useState({
    fills: true,
    signals: true,
    alerts: true,
    errors: true,
    summary: false,
  })

  // Load saved settings from the backend (when connected).
  useEffect(() => {
    let active = true
    void api.getSettings().then((s) => {
      if (!active || !s) return
      const ui = s.ui
      if (typeof ui.apiUrl === 'string') setApiUrl(ui.apiUrl)
      if (typeof ui.network === 'string') setNetwork(ui.network)
      if (typeof ui.orderSize === 'string') setOrderSize(ui.orderSize)
      if (typeof ui.slippage === 'number') setSlippage(ui.slippage)
      if (typeof ui.tif === 'string') setTif(ui.tif)
      if (typeof ui.confirmOrders === 'boolean') setConfirmOrders(ui.confirmOrders)
      if (ui.notif && typeof ui.notif === 'object') {
        setNotif((n) => ({ ...n, ...(ui.notif as Partial<typeof n>) }))
      }
      setDayLoss(s.risk.dailyLossLimitPct)
      setMaxExposure(s.risk.maxGrossExposurePct)
      setAutoKill(s.risk.autoKillSwitch)
    })
    return () => {
      active = false
    }
  }, [])

  const save = () => {
    void api.saveSettings({
      ui: { apiUrl, network, orderSize, slippage, tif, confirmOrders, notif },
      risk: { dailyLossLimitPct: dayLoss, maxGrossExposurePct: maxExposure, autoKillSwitch: autoKill },
    })
    addToast({
      variant: 'success',
      title: 'Settings saved',
      description: api.isLive ? 'Stored in the bot database' : 'Demo mode — not persisted',
    })
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Connection, trading defaults, risk guards and notifications for your bot."
        actions={<Button onClick={save}>Save changes</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Connection" subtitle="How the dashboard talks to your bot & Polymarket">
          <div className="divide-y divide-border">
            <div className="pb-3">
              <label className="mb-1.5 block text-[12px] font-medium text-muted">API base URL</label>
              <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
            </div>
            <div className="py-3">
              <label className="mb-1.5 block text-[12px] font-medium text-muted">API key</label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
            <div className="py-3">
              <label className="mb-1.5 block text-[12px] font-medium text-muted">Wallet</label>
              <Input value={bot.wallet} readOnly className="font-mono text-xs" />
            </div>
            <SettingRow label="Network">
              <Select value={network} onChange={(e) => setNetwork(e.target.value)} className="w-40">
                <option>Polygon</option>
                <option>Ethereum</option>
                <option>Base</option>
              </Select>
            </SettingRow>
            <div className="pt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addToast({ variant: 'success', title: 'Connection OK', description: `${bot.latencyMs}ms · ${network}` })}
              >
                Test connection
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Trading defaults" subtitle="Applied to manual orders">
          <div className="divide-y divide-border">
            <div className="pb-3">
              <label className="mb-1.5 block text-[12px] font-medium text-muted">Default order size</label>
              <Input value={orderSize} onChange={(e) => setOrderSize(e.target.value)} rightSlot="USDC" />
            </div>
            <div className="py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted">Max slippage</span>
                <span className="text-xs font-semibold text-foreground tabular-nums">{slippage}%</span>
              </div>
              <Slider value={slippage} min={0.1} max={5} step={0.1} onChange={setSlippage} />
            </div>
            <SettingRow label="Default time in force">
              <Select value={tif} onChange={(e) => setTif(e.target.value)} className="w-32">
                <option value="GTC">GTC</option>
                <option value="IOC">IOC</option>
                <option value="FOK">FOK</option>
                <option value="GTD">GTD</option>
              </Select>
            </SettingRow>
            <SettingRow label="Confirm before sending" description="Show a review modal for manual orders">
              <Switch checked={confirmOrders} onCheckedChange={setConfirmOrders} />
            </SettingRow>
          </div>
        </SectionCard>

        <SectionCard title="Risk guards" subtitle="Global limits enforced by the bot">
          <div className="divide-y divide-border">
            <div className="pb-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted">Daily loss limit</span>
                <span className="text-xs font-semibold text-foreground tabular-nums">{dayLoss}%</span>
              </div>
              <Slider value={dayLoss} min={1} max={20} step={1} onChange={setDayLoss} />
            </div>
            <div className="py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted">Max gross exposure</span>
                <span className="text-xs font-semibold text-foreground tabular-nums">{maxExposure}%</span>
              </div>
              <Slider value={maxExposure} min={10} max={100} step={5} onChange={setMaxExposure} />
            </div>
            <SettingRow label="Auto kill-switch" description="Pause all strategies on breach">
              <Switch checked={autoKill} onCheckedChange={setAutoKill} />
            </SettingRow>
          </div>
        </SectionCard>

        <SectionCard title="Notifications" subtitle="What lands in your alerts feed">
          <div className="divide-y divide-border">
            <SettingRow label="Order fills">
              <Switch checked={notif.fills} onCheckedChange={(v) => setNotif((n) => ({ ...n, fills: v }))} />
            </SettingRow>
            <SettingRow label="Strategy signals">
              <Switch checked={notif.signals} onCheckedChange={(v) => setNotif((n) => ({ ...n, signals: v }))} />
            </SettingRow>
            <SettingRow label="Risk alerts">
              <Switch checked={notif.alerts} onCheckedChange={(v) => setNotif((n) => ({ ...n, alerts: v }))} />
            </SettingRow>
            <SettingRow label="Errors & disconnects">
              <Switch checked={notif.errors} onCheckedChange={(v) => setNotif((n) => ({ ...n, errors: v }))} />
            </SettingRow>
            <SettingRow label="Daily summary email">
              <Switch checked={notif.summary} onCheckedChange={(v) => setNotif((n) => ({ ...n, summary: v }))} />
            </SettingRow>
          </div>
        </SectionCard>

        <SectionCard title="Appearance" subtitle="Theme preference" className="lg:col-span-2">
          <SettingRow label="Theme" description="Choose how the dashboard looks">
            <SegmentedControl
              value={theme}
              onChange={setTheme}
              options={[
                { label: 'Dark', value: 'dark' },
                { label: 'Light', value: 'light' },
              ]}
            />
          </SettingRow>
        </SectionCard>
      </div>
    </div>
  )
}
