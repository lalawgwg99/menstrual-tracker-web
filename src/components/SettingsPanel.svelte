<script lang="ts">
  import ReminderSettings from './ReminderSettings.svelte'
  import { store } from '../lib/store.svelte.js'
  import { formatLocalDate } from '../lib/cycle.js'
  import { enableAppLock, disableAppLock, isAppLockEnabled, isWebAuthnSupported } from '../lib/webauthn.js'
  import { isSoundEnabled, setSoundEnabled, playTap } from '../lib/sound.js'

  let lockSupported = $state(isWebAuthnSupported())
  let lockEnabled = $state(lockSupported ? isAppLockEnabled() : false)
  let appLockBusy = $state(false)
  let appLockError = $state('')
  let backupError = $state('')
  let soundEnabled = $state(isSoundEnabled())

  let editingCycleLength = $state(String(store.cycleLength))
  let editingPeriodLength = $state(String(store.periodLength))

  $effect(() => {
    editingCycleLength = String(store.cycleLength)
    editingPeriodLength = String(store.periodLength)
  })

  function saveCycleLength() {
    const val = parseInt(editingCycleLength)
    if (!isNaN(val) && val >= 20 && val <= 45) store.setDefaultCycleLength(val)
  }

  function savePeriodLength() {
    const val = parseInt(editingPeriodLength)
    if (!isNaN(val) && val >= 2 && val <= 10) store.setDefaultPeriodLength(val)
  }

  async function handleEnableLock() {
    if (!lockSupported || appLockBusy) return
    appLockBusy = true
    appLockError = ''
    try {
      const ok = await enableAppLock()
      lockEnabled = ok
      if (!ok) appLockError = '啟用失敗，請重試'
    } catch {
      appLockError = '啟用失敗，請重試'
    } finally {
      appLockBusy = false
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-lock-changed'))
    }
  }

  function handleDisableLock() {
    disableAppLock()
    lockEnabled = false
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-lock-changed'))
  }

  function toggleSound() {
    soundEnabled = !soundEnabled
    setSoundEnabled(soundEnabled)
    playTap()
  }

  function exportBackup() {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: {
        entries: store.entries,
        cycleLength: store.cycleLength,
        periodLength: store.periodLength,
        reminderSettings: JSON.parse(localStorage.getItem('reminder-settings') ?? '{}'),
        soundEnabled: localStorage.getItem('ui-sound-enabled'),
        appLockEnabled: localStorage.getItem('app-lock-enabled')
      }
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cycle-backup-${formatLocalDate(new Date())}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importBackup(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    backupError = ''

    const raw = await file.text()
    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch {
      backupError = '備份檔格式不正確'
      return
    }

    const data = parsed?.app
    if (!data || !Array.isArray(data.entries)) {
      backupError = '找不到可匯入的資料'
      return
    }

    const ok = confirm('匯入後會覆蓋目前本機資料，確定要繼續嗎？')
    if (!ok) return

    store.replaceEntries(data.entries)

    if (typeof data.cycleLength === 'number') {
      store.setDefaultCycleLength(data.cycleLength)
      editingCycleLength = String(data.cycleLength)
    }
    if (typeof data.periodLength === 'number') {
      store.setDefaultPeriodLength(data.periodLength)
      editingPeriodLength = String(data.periodLength)
    }

    if (data.reminderSettings) {
      localStorage.setItem('reminder-settings', JSON.stringify(data.reminderSettings))
    }
    if (typeof data.soundEnabled === 'string') {
      localStorage.setItem('ui-sound-enabled', data.soundEnabled)
      soundEnabled = data.soundEnabled === 'true'
    }

    // App Lock credentials are device-specific, so do not restore them from backup.
    disableAppLock()
    lockEnabled = false

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-lock-changed'))
      window.dispatchEvent(new CustomEvent('app-backup-restored'))
    }

    alert('備份已匯入。App 會重新整理以套用設定。')
    window.location.reload()
  }
</script>

<div class="settings-panel">
  <div class="card hero-card">
    <div class="hero-title">設定</div>
    <div class="hero-sub">把提醒、音效、隱私和預設值集中管理。</div>
  </div>

  <ReminderSettings />

  <div class="card">
    <h3 class="section-title">週期預設</h3>
    <div class="setting-item">
      <span class="setting-label">預設週期長度</span>
      <div class="setting-input-group">
        <input class="setting-input" type="number" bind:value={editingCycleLength} min="20" max="45" onblur={saveCycleLength} />
        <span class="setting-unit">天</span>
      </div>
    </div>
    <div class="setting-item">
      <span class="setting-label">預設經期天數</span>
      <div class="setting-input-group">
        <input class="setting-input" type="number" bind:value={editingPeriodLength} min="2" max="10" onblur={savePeriodLength} />
        <span class="setting-unit">天</span>
      </div>
    </div>
  </div>

  <div class="card">
    <h3 class="section-title">隱私與音效</h3>
    <div class="setting-item">
      <span class="setting-label">Face ID / Touch ID 解鎖</span>
      {#if !lockSupported}
        <span class="setting-hint">此裝置不支援</span>
      {:else if lockEnabled}
        <button class="setting-btn" onclick={handleDisableLock}>關閉</button>
      {:else}
        <button class="setting-btn primary" onclick={handleEnableLock} disabled={appLockBusy}>
          {appLockBusy ? '啟用中…' : '啟用'}
        </button>
      {/if}
    </div>
    {#if appLockError}
      <div class="setting-note error">{appLockError}</div>
    {:else}
      <div class="setting-note">資料只存在本機。若啟用，回到頁面時會要求解鎖。</div>
    {/if}

    <div class="setting-item">
      <span class="setting-label">操作音效</span>
      <button class="setting-btn {soundEnabled ? 'primary' : ''}" onclick={toggleSound}>
        {soundEnabled ? '開啟' : '關閉'}
      </button>
    </div>
  </div>

  <div class="card">
    <h3 class="section-title">資料備份</h3>
    <p class="setting-note">可匯出完整本機資料，日後再匯回。App Lock 的憑證屬於裝置專屬，不會一起備份。</p>
    <div class="backup-actions">
      <button class="setting-btn primary" onclick={exportBackup}>匯出備份</button>
      <label class="setting-btn file-btn">
        匯入備份
        <input type="file" accept="application/json" onchange={importBackup} />
      </label>
    </div>
    {#if backupError}
      <div class="setting-note error">{backupError}</div>
    {/if}
  </div>
</div>

<style>
  .settings-panel {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .card {
    background: var(--card-bg);
    border-radius: 14px;
    padding: 16px;
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
  }

  .hero-card {
    background: linear-gradient(180deg, var(--bg-soft), var(--card-bg));
  }

  .hero-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
  }

  .hero-sub {
    margin-top: 6px;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .section-title {
    font-size: 13px;
    font-weight: 500;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
    padding-left: 4px;
  }

  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border-top: 0.5px solid var(--border);
  }

  .setting-item:first-of-type {
    border-top: none;
    padding-top: 8px;
  }

  .setting-label {
    font-size: 15px;
    color: var(--text);
  }

  .setting-input-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .setting-input {
    width: 62px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 16px;
    text-align: center;
    color: var(--text);
    background: var(--bg);
  }

  .setting-unit {
    font-size: 13px;
    color: var(--text-muted);
  }

  .setting-btn {
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 10px;
  }

  .setting-btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg);
  }

  .setting-btn:disabled {
    opacity: 0.6;
  }

  .setting-hint,
  .setting-note {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .setting-note.error {
    color: #b91c1c;
  }

  .backup-actions {
    display: flex;
    gap: 10px;
    margin-top: 10px;
    flex-wrap: wrap;
  }

  .file-btn {
    position: relative;
    overflow: hidden;
    cursor: pointer;
  }

  .file-btn input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
</style>
