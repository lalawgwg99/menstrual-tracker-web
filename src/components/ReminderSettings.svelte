<script lang="ts">
  import { requestNotificationPermission, scheduleReminders } from '../lib/notifications.js'
  import { store } from '../lib/store.svelte.js'

  // 從 localStorage 載入設定
  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem('reminder-settings') ?? '{}')
    } catch { return {} }
  }

  let settings = $state(loadSettings())
  let permission = $state(typeof window !== 'undefined' ? Notification.permission : 'default')

  let periodReminder = $state(settings.periodReminder ?? false)
  let tempReminder = $state(settings.tempReminder ?? false)
  let tempTime = $state(settings.tempTime ?? '06:30')

  function saveSettings() {
    const s = { periodReminder, tempReminder, tempTime }
    localStorage.setItem('reminder-settings', JSON.stringify(s))
    scheduleReminders(
      store.entries,
      { cycleLength: store.cycleLength, periodLength: store.periodLength },
      periodReminder,
      tempReminder,
      tempTime
    )
  }

  async function handleRequestPermission() {
    const granted = await requestNotificationPermission()
    permission = Notification.permission
    if (granted) saveSettings()
  }
</script>

<div class="reminder-card">
  <div class="reminder-header">
    <span class="reminder-title">🔔 提醒設定</span>
    {#if permission === 'granted'}
      <span class="perm-badge granted">已開啟 ✓</span>
    {:else if permission === 'denied'}
      <span class="perm-badge denied">已拒絕</span>
    {:else}
      <button class="perm-btn" onclick={handleRequestPermission}>開啟通知</button>
    {/if}
  </div>

  {#if permission === 'denied'}
    <p class="perm-hint">請到瀏覽器設定手動開啟此網站的通知權限</p>
  {/if}

  {#if permission === 'granted'}
    <div class="reminder-row">
      <div class="reminder-info">
        <span class="reminder-label">🌸 經期提醒</span>
        <span class="reminder-sub">預計來潮前 3 天通知</span>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" bind:checked={periodReminder} onchange={saveSettings} />
        <span class="toggle-slider"></span>
      </label>
    </div>

    <div class="reminder-row">
      <div class="reminder-info">
        <span class="reminder-label">🌡️ 體溫提醒</span>
        <input
          type="time"
          bind:value={tempTime}
          onchange={saveSettings}
          class="time-input"
        />
      </div>
      <label class="toggle-switch">
        <input type="checkbox" bind:checked={tempReminder} onchange={saveSettings} />
        <span class="toggle-slider"></span>
      </label>
    </div>
  {/if}
</div>

<style>
  .reminder-card {
    background: white;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 2px 12px rgba(244, 63, 94, 0.08);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .reminder-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .reminder-title { font-size: 15px; font-weight: 600; color: #333; }
  .perm-badge { font-size: 12px; padding: 3px 8px; border-radius: 12px; }
  .perm-badge.granted { background: #dcfce7; color: #166534; }
  .perm-badge.denied { background: #fee2e2; color: #991b1b; }
  .perm-btn {
    font-size: 12px; padding: 5px 12px; border-radius: 20px;
    background: var(--period); color: white; border: none; cursor: pointer;
  }
  .perm-hint { font-size: 12px; color: #f97316; }
  .reminder-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 0;
    border-top: 1px solid #fce7f0;
  }
  .reminder-info { display: flex; flex-direction: column; gap: 3px; }
  .reminder-label { font-size: 14px; color: #444; }
  .reminder-sub { font-size: 11px; color: #aaa; }
  .time-input {
    font-size: 13px; border: 1px solid #e8d0d8; border-radius: 8px;
    padding: 3px 6px; color: #555; margin-top: 4px;
    font-family: inherit;
  }
  .toggle-switch { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
  .toggle-switch input { opacity: 0; width: 0; height: 0; }
  .toggle-slider {
    position: absolute; inset: 0; background: #ddd;
    border-radius: 24px; cursor: pointer; transition: background 0.2s;
  }
  .toggle-slider::before {
    content: ''; position: absolute;
    width: 18px; height: 18px; left: 3px; top: 3px;
    background: white; border-radius: 50%; transition: transform 0.2s;
  }
  .toggle-switch input:checked + .toggle-slider { background: var(--period); }
  .toggle-switch input:checked + .toggle-slider::before { transform: translateX(20px); }
</style>
