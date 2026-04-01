<script lang="ts">
  import { store } from './lib/store.svelte.js'
  import { scheduleReminders } from './lib/notifications.js'
  import { isAppLockEnabled, isWebAuthnSupported, unlockApp } from './lib/webauthn.js'
  import CalendarView from './components/CalendarView.svelte'
  import LogPanel from './components/LogPanel.svelte'
  import StatsPanel from './components/StatsPanel.svelte'
  import NavBar from './components/NavBar.svelte'

  let activeTab = $state<'calendar' | 'log' | 'stats'>('calendar')
  let lockSupported = $state(isWebAuthnSupported())
  let lockEnabled = $state(lockSupported ? isAppLockEnabled() : false)
  let appLocked = $state(lockSupported ? isAppLockEnabled() : false)
  let unlocking = $state(false)
  let lockError = $state('')

  $effect(() => {
    store.init()
    try {
      const rs = JSON.parse(localStorage.getItem('reminder-settings') ?? '{}')
      if ((rs.periodReminder || rs.tempReminder) && typeof Notification !== 'undefined') {
        scheduleReminders(
          store.entries,
          { cycleLength: store.cycleLength, periodLength: store.periodLength },
          rs.periodReminder ?? false,
          rs.tempReminder ?? false,
          rs.tempTime ?? '06:30'
        )
      }
    } catch {}
  })

  async function handleUnlock() {
    if (!lockSupported || unlocking) return
    unlocking = true
    lockError = ''
    try {
      const ok = await unlockApp()
      if (ok) appLocked = false
      else lockError = '解鎖失敗，請重試'
    } catch {
      lockError = '解鎖失敗，請重試'
    } finally {
      unlocking = false
    }
  }

  $effect(() => {
    if (typeof window === 'undefined') return
    const updateLock = () => {
      lockEnabled = isAppLockEnabled()
      appLocked = lockEnabled
    }
    const onVisibility = () => {
      if (document.hidden && lockEnabled) appLocked = true
    }
    window.addEventListener('app-lock-changed', updateLock)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('app-lock-changed', updateLock)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  })
</script>

<div class="app">
  <main class="content">
    {#if activeTab === 'calendar'}
      <CalendarView onNavigate={(tab) => activeTab = tab} />
    {:else if activeTab === 'log'}
      <LogPanel />
    {:else}
      <StatsPanel />
    {/if}
  </main>
  <NavBar {activeTab} onTabChange={(tab) => activeTab = tab} />

  {#if appLocked && lockEnabled}
    <div class="app-lock">
      <div class="lock-card">
        <div class="lock-title">已上鎖</div>
        <div class="lock-sub">使用 Face ID / Touch ID 解鎖</div>
        <button class="lock-action" onclick={handleUnlock} disabled={unlocking}>
          {unlocking ? '解鎖中…' : '解鎖'}
        </button>
        {#if lockError}
          <div class="lock-error">{lockError}</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    max-width: 430px;
    margin: 0 auto;
    background: var(--bg);
    position: relative;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 72px;
  }

  .app-lock {
    position: fixed;
    inset: 0;
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .lock-card {
    background: var(--card-bg);
    padding: 24px;
    border-radius: 18px;
    box-shadow: var(--shadow);
    text-align: center;
    width: 80%;
    max-width: 320px;
  }

  .lock-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 6px;
  }

  .lock-sub {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 16px;
  }

  .lock-action {
    border: none;
    padding: 10px 16px;
    border-radius: 12px;
    background: var(--text);
    color: var(--bg);
    font-size: 14px;
    font-weight: 600;
  }

  .lock-action:disabled {
    opacity: 0.6;
  }

  .lock-error {
    margin-top: 10px;
    font-size: 12px;
    color: #b91c1c;
  }
</style>
