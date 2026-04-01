<script lang="ts">
  import { store } from '../lib/store.svelte.js'
  import { addDays } from '../lib/cycle.js'
  import type { FlowLevel, MoodTag, SymptomTag, DailyLog } from '../lib/types.js'
  import ReminderSettings from './ReminderSettings.svelte'
  import { enableAppLock, disableAppLock, isWebAuthnSupported, isAppLockEnabled } from '../lib/webauthn.js'

  let showForm = $state(false)
  let startDate = $state('')
  let endDate = $state('')
  let expandedId = $state<string | null>(null)
  let appLockSupported = $state(isWebAuthnSupported())
  let appLockEnabled = $state(appLockSupported ? isAppLockEnabled() : false)
  let appLockBusy = $state(false)
  let appLockError = $state('')

  let defaultEndDate = $derived(
    startDate ? addDays(startDate, store.periodLength - 1) : ''
  )

  $effect(() => {
    if (startDate && !endDate) {
      endDate = defaultEndDate
    }
  })

  let editingCycleLength = $state(String(store.cycleLength))
  let editingPeriodLength = $state(String(store.periodLength))

  $effect(() => {
    editingCycleLength = String(store.cycleLength)
    editingPeriodLength = String(store.periodLength)
  })

  function handleSubmit() {
    if (!startDate || !endDate) return
    if (endDate < startDate) return
    store.addEntry({ startDate, endDate })
    startDate = ''
    endDate = ''
    showForm = false
  }

  function handleDelete(id: string) {
    if (confirm('確定要刪除這筆記錄嗎？')) {
      store.deleteEntry(id)
    }
  }

  function saveCycleLength() {
    const val = parseInt(editingCycleLength)
    if (!isNaN(val) && val >= 20 && val <= 45) {
      store.setDefaultCycleLength(val)
    }
  }

  function savePeriodLength() {
    const val = parseInt(editingPeriodLength)
    if (!isNaN(val) && val >= 2 && val <= 10) {
      store.setDefaultPeriodLength(val)
    }
  }

  let sortedEntries = $derived(
    [...store.entries].sort((a, b) => b.startDate.localeCompare(a.startDate))
  )

  function formatDateDisplay(date: string): string {
    const d = new Date(date + 'T00:00:00')
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }

  function getDuration(entry: { startDate: string; endDate: string }): number {
    const start = new Date(entry.startDate + 'T00:00:00')
    const end = new Date(entry.endDate + 'T00:00:00')
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  function getDatesInRange(s: string, e: string): string[] {
    const dates: string[] = []
    const start = new Date(s + 'T00:00:00')
    const end = new Date(e + 'T00:00:00')
    const cur = new Date(start)
    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0])
      cur.setDate(cur.getDate() + 1)
    }
    return dates
  }

  const flowOptions: { value: FlowLevel; label: string }[] = [
    { value: 'spotting', label: '點滴💧' },
    { value: 'light', label: '輕🩸' },
    { value: 'medium', label: '中🩸🩸' },
    { value: 'heavy', label: '重🩸🩸🩸' }
  ]

  const symptomOptions: { value: SymptomTag; label: string }[] = [
    { value: 'cramps', label: '痛經' },
    { value: 'headache', label: '頭痛' },
    { value: 'bloating', label: '腹脹' },
    { value: 'backpain', label: '腰痛' },
    { value: 'acne', label: '長痘' },
    { value: 'breast_tenderness', label: '胸脹' },
    { value: 'nausea', label: '噁心' }
  ]

  const mucusOptions: { value: DailyLog['cervicalMucus']; label: string }[] = [
    { value: 'dry', label: '乾燥' },
    { value: 'sticky', label: '黏稠' },
    { value: 'creamy', label: '乳狀' },
    { value: 'eggwhite', label: '蛋清' }
  ]

  const moodOptions: { value: MoodTag; emoji: string }[] = [
    { value: 'happy', emoji: '😊' },
    { value: 'calm', emoji: '😌' },
    { value: 'sad', emoji: '😢' },
    { value: 'irritable', emoji: '😤' },
    { value: 'anxious', emoji: '😰' },
    { value: 'tired', emoji: '😴' }
  ]

  function getLog(entryId: string, date: string): DailyLog {
    return store.getDailyLog(entryId, date) ?? { date }
  }

  function setFlow(entryId: string, date: string, flow: FlowLevel) {
    const log = getLog(entryId, date)
    const newFlow = log.flow === flow ? undefined : flow
    store.upsertDailyLog(entryId, { ...log, flow: newFlow })
  }

  function toggleSymptom(entryId: string, date: string, symptom: SymptomTag) {
    const log = getLog(entryId, date)
    const existing = log.symptoms ?? []
    const newSymptoms = existing.includes(symptom)
      ? existing.filter(s => s !== symptom)
      : [...existing, symptom]
    store.upsertDailyLog(entryId, { ...log, symptoms: newSymptoms })
  }

  function setMood(entryId: string, date: string, mood: MoodTag) {
    const log = getLog(entryId, date)
    const newMood = log.mood === mood ? undefined : mood
    store.upsertDailyLog(entryId, { ...log, mood: newMood })
  }

  function setTemperature(entryId: string, date: string, temp: string) {
    const log = getLog(entryId, date)
    const val = parseFloat(temp)
    store.upsertDailyLog(entryId, { ...log, temperature: isNaN(val) ? undefined : val })
  }

  function setNote(entryId: string, date: string, note: string) {
    const log = getLog(entryId, date)
    store.upsertDailyLog(entryId, { ...log, note })
  }

  async function handleEnableLock() {
    if (!appLockSupported || appLockBusy) return
    appLockBusy = true
    appLockError = ''
    try {
      const ok = await enableAppLock()
      appLockEnabled = ok
      if (!ok) appLockError = '啟用失敗，請重試'
    } catch {
      appLockError = '啟用失敗，請重試'
    } finally {
      appLockBusy = false
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app-lock-changed'))
      }
    }
  }

  function handleDisableLock() {
    disableAppLock()
    appLockEnabled = false
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-lock-changed'))
    }
  }

  function setMucus(entryId: string, date: string, value: DailyLog['cervicalMucus']) {
    const log = getLog(entryId, date)
    const nextVal = log.cervicalMucus === value ? undefined : value
    store.upsertDailyLog(entryId, { ...log, cervicalMucus: nextVal })
  }

  function setOvulationTest(entryId: string, date: string, value: DailyLog['ovulationTest']) {
    const log = getLog(entryId, date)
    const nextVal = log.ovulationTest === value ? undefined : value
    store.upsertDailyLog(entryId, { ...log, ovulationTest: nextVal })
  }

  function setSex(entryId: string, date: string, value: boolean) {
    const log = getLog(entryId, date)
    const nextVal = log.sex === value ? undefined : value
    store.upsertDailyLog(entryId, { ...log, sex: nextVal })
  }

  function setWeight(entryId: string, date: string, weight: string) {
    const log = getLog(entryId, date)
    const val = parseFloat(weight)
    store.upsertDailyLog(entryId, { ...log, weight: isNaN(val) ? undefined : val })
  }

  function setMedication(entryId: string, date: string, medication: string) {
    const log = getLog(entryId, date)
    store.upsertDailyLog(entryId, { ...log, medication })
  }
</script>

<div class="log-panel">
  <!-- Add entry button / form -->
  <div class="card">
    {#if !showForm}
      <button class="add-btn" onclick={() => { showForm = true; startDate = ''; endDate = '' }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        新增經期記錄
      </button>
    {:else}
      <h3 class="form-title">新增記錄</h3>
      <div class="form-group">
        <label class="form-label">開始日期</label>
        <input
          type="date"
          class="form-input"
          bind:value={startDate}
          onchange={() => { endDate = startDate ? addDays(startDate, store.periodLength - 1) : '' }}
        />
      </div>
      <div class="form-group">
        <label class="form-label">結束日期</label>
        <input
          type="date"
          class="form-input"
          bind:value={endDate}
          min={startDate}
        />
      </div>
      <div class="form-actions">
        <button class="btn-cancel" onclick={() => showForm = false}>取消</button>
        <button class="btn-save" onclick={handleSubmit} disabled={!startDate || !endDate}>儲存</button>
      </div>
    {/if}
  </div>

  <!-- Reminder settings -->
  <ReminderSettings />

  <!-- App lock -->
  <div class="card">
    <h3 class="section-title">隱私保護</h3>
    <div class="setting-item">
      <span class="setting-label">Face ID / Touch ID 解鎖</span>
      {#if !appLockSupported}
        <span class="setting-hint">此裝置不支援</span>
      {:else if appLockEnabled}
        <button class="lock-btn" onclick={handleDisableLock}>關閉</button>
      {:else}
        <button class="lock-btn primary" onclick={handleEnableLock} disabled={appLockBusy}>
          {appLockBusy ? '啟用中…' : '啟用'}
        </button>
      {/if}
    </div>
    {#if appLockError}
      <div class="lock-error">{appLockError}</div>
    {/if}
    <div class="lock-note">僅在本機加密保存，不會上傳雲端。</div>
  </div>

  <!-- Settings card -->
  <div class="card">
    <h3 class="section-title">週期設定</h3>
    <div class="setting-item">
      <span class="setting-label">預設週期長度</span>
      <div class="setting-input-group">
        <input
          type="number"
          class="setting-input"
          bind:value={editingCycleLength}
          min="20"
          max="45"
          onblur={saveCycleLength}
        />
        <span class="setting-unit">天</span>
      </div>
    </div>
    <div class="setting-item">
      <span class="setting-label">預設經期天數</span>
      <div class="setting-input-group">
        <input
          type="number"
          class="setting-input"
          bind:value={editingPeriodLength}
          min="2"
          max="10"
          onblur={savePeriodLength}
        />
        <span class="setting-unit">天</span>
      </div>
    </div>
  </div>

  <!-- Records list -->
  <div class="card">
    <h3 class="section-title">經期記錄（共 {store.entries.length} 筆）</h3>
    {#if sortedEntries.length === 0}
      <p class="empty-text">還沒有記錄，點上方按鈕新增第一筆！</p>
    {:else}
      <div class="entries-list">
        {#each sortedEntries as entry (entry.id)}
          <div class="entry-item">
            <div class="entry-icon">🩸</div>
            <div class="entry-info">
              <div class="entry-dates num-rounded">{formatDateDisplay(entry.startDate)} — {formatDateDisplay(entry.endDate)}</div>
              <div class="entry-duration num-rounded">{getDuration(entry)} 天</div>
            </div>
            <button
              class="log-btn"
              onclick={() => expandedId = expandedId === entry.id ? null : entry.id}
              title="詳細記錄"
            >📝</button>
            <button class="delete-btn" onclick={() => handleDelete(entry.id)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>

          {#if expandedId === entry.id}
            <div class="daily-logs-section">
              {#each getDatesInRange(entry.startDate, entry.endDate) as date}
                {@const log = getLog(entry.id, date)}
                <div class="daily-log-day">
                  <div class="day-header num-rounded">{formatDateDisplay(date)}</div>

                  <!-- Flow -->
                  <div class="log-field">
                    <span class="log-field-label">流量</span>
                    <div class="tag-group">
                      {#each flowOptions as opt}
                        <button
                          class="tag-btn flow-btn {log.flow === opt.value ? 'active' : ''}"
                          onclick={() => setFlow(entry.id, date, opt.value)}
                        >{opt.label}</button>
                      {/each}
                    </div>
                  </div>

                  <!-- Symptoms -->
                  <div class="log-field">
                    <span class="log-field-label">症狀</span>
                    <div class="tag-group">
                      {#each symptomOptions as opt}
                        <button
                          class="tag-btn {(log.symptoms ?? []).includes(opt.value) ? 'active' : ''}"
                          onclick={() => toggleSymptom(entry.id, date, opt.value)}
                        >{opt.label}</button>
                      {/each}
                    </div>
                  </div>

                  <!-- Mood -->
                  <div class="log-field">
                    <span class="log-field-label">心情</span>
                    <div class="tag-group">
                      {#each moodOptions as opt}
                        <button
                          class="tag-btn mood-btn {log.mood === opt.value ? 'active' : ''}"
                          onclick={() => setMood(entry.id, date, opt.value)}
                        >{opt.emoji}</button>
                      {/each}
                    </div>
                  </div>

                  <!-- Temperature -->
                  <div class="log-field">
                    <span class="log-field-label">體溫</span>
                    <div class="temp-input-group">
                      <input
                        type="number"
                        class="temp-input"
                        min="35.0"
                        max="38.5"
                        step="0.1"
                        value={log.temperature ?? ''}
                        oninput={(e) => setTemperature(entry.id, date, (e.target as HTMLInputElement).value)}
                        placeholder="36.5"
                      />
                      <span class="temp-unit">°C</span>
                    </div>
                  </div>

                  <!-- Ovulation Test -->
                  <div class="log-field">
                    <span class="log-field-label">排卵試紙</span>
                    <div class="tag-group">
                      <button
                        class="tag-btn {log.ovulationTest === 'negative' ? 'active' : ''}"
                        onclick={() => setOvulationTest(entry.id, date, 'negative')}
                      >陰性</button>
                      <button
                        class="tag-btn {log.ovulationTest === 'positive' ? 'active' : ''}"
                        onclick={() => setOvulationTest(entry.id, date, 'positive')}
                      >陽性</button>
                    </div>
                  </div>

                  <!-- Cervical Mucus -->
                  <div class="log-field">
                    <span class="log-field-label">宮頸黏液</span>
                    <div class="tag-group">
                      {#each mucusOptions as opt}
                        <button
                          class="tag-btn {(log.cervicalMucus ?? '') === opt.value ? 'active' : ''}"
                          onclick={() => setMucus(entry.id, date, opt.value)}
                        >{opt.label}</button>
                      {/each}
                    </div>
                  </div>

                  <!-- Sex -->
                  <div class="log-field">
                    <span class="log-field-label">性行為</span>
                    <div class="tag-group">
                      <button
                        class="tag-btn {log.sex === true ? 'active' : ''}"
                        onclick={() => setSex(entry.id, date, true)}
                      >有</button>
                      <button
                        class="tag-btn {log.sex === false ? 'active' : ''}"
                        onclick={() => setSex(entry.id, date, false)}
                      >無</button>
                    </div>
                  </div>

                  <!-- Weight -->
                  <div class="log-field">
                    <span class="log-field-label">體重</span>
                    <div class="temp-input-group">
                      <input
                        type="number"
                        class="temp-input"
                        min="30"
                        max="200"
                        step="0.1"
                        value={log.weight ?? ''}
                        oninput={(e) => setWeight(entry.id, date, (e.target as HTMLInputElement).value)}
                        placeholder="52.0"
                      />
                      <span class="temp-unit">kg</span>
                    </div>
                  </div>

                  <!-- Medication -->
                  <div class="log-field">
                    <span class="log-field-label">用藥</span>
                    <input
                      class="note-input"
                      value={log.medication ?? ''}
                      oninput={(e) => setMedication(entry.id, date, (e.target as HTMLInputElement).value)}
                      placeholder="藥名/劑量"
                    />
                  </div>

                  <!-- Note -->
                  <div class="log-field">
                    <span class="log-field-label">備注</span>
                    <textarea
                      class="note-input"
                      rows="1"
                      value={log.note ?? ''}
                      oninput={(e) => setNote(entry.id, date, (e.target as HTMLTextAreaElement).value)}
                      placeholder="今天的感受..."
                    ></textarea>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .log-panel {
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
  }

  .add-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px;
    background: var(--period);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 17px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.1s, transform 0.1s;
    -webkit-tap-highlight-color: transparent;
  }

  .add-btn:active {
    opacity: 0.7;
    transform: scale(0.98);
  }

  .form-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 16px;
  }

  .form-group {
    margin-bottom: 12px;
  }

  .form-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 6px;
    padding-left: 4px;
  }

  .form-input {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 16px;
    color: var(--text);
    background: var(--bg);
    outline: none;
    box-sizing: border-box;
    -webkit-appearance: none;
  }

  .form-input:focus {
    border-color: var(--period);
  }

  .form-actions {
    display: flex;
    gap: 10px;
    margin-top: 16px;
  }

  .btn-cancel {
    flex: 1;
    padding: 12px;
    background: var(--bg);
    color: var(--period);
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-save {
    flex: 2;
    padding: 12px;
    background: var(--period);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-save:active, .btn-cancel:active {
    opacity: 0.7;
  }

  .btn-save:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .section-title {
    font-size: 13px;
    font-weight: 500;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
    padding-left: 8px;
  }

  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 8px;
    border-bottom: 0.5px solid var(--border);
  }

  .setting-item:last-child {
    border-bottom: none;
  }

  .setting-label {
    font-size: 16px;
    color: var(--text);
  }

  .setting-input-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .setting-input {
    width: 60px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 16px;
    text-align: center;
    color: var(--text);
    background: var(--bg);
    outline: none;
    -webkit-appearance: none;
  }

  .setting-input:focus {
    border-color: var(--period);
  }

  .setting-unit {
    font-size: 14px;
    color: var(--text-muted);
  }

  .setting-hint {
    font-size: 12px;
    color: var(--text-muted);
  }

  .lock-btn {
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 10px;
  }

  .lock-btn.primary {
    background: var(--text);
    color: var(--bg);
    border-color: var(--text);
  }

  .lock-btn:disabled {
    opacity: 0.6;
  }

  .lock-error {
    margin-top: 6px;
    font-size: 12px;
    color: #b91c1c;
  }

  .lock-note {
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .empty-text {
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
    padding: 20px 0;
  }

  .entries-list {
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    border-radius: 12px;
    overflow: hidden;
  }

  .entry-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 0.5px solid var(--border);
  }
  .entry-item:last-child {
    border-bottom: none;
  }

  .entry-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .entry-info {
    flex: 1;
  }

  .entry-dates {
    font-size: 16px;
    color: var(--text);
    font-weight: 500;
  }

  .entry-duration {
    font-size: 14px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .log-btn, .delete-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    color: var(--text-muted);
    transition: opacity 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .log-btn:active, .delete-btn:active {
    opacity: 0.5;
  }
  
  .delete-btn {
    color: var(--period);
  }

  /* Daily log section */
  .daily-logs-section {
    background: var(--bg);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    border-bottom: 0.5px solid var(--border);
  }

  .daily-log-day {
    background: var(--card-bg);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .day-header {
    font-size: 14px;
    font-weight: 600;
    color: var(--period);
    padding-bottom: 8px;
    border-bottom: 0.5px solid var(--border);
  }

  .log-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .log-field-label {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .tag-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .temp-input-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .temp-input {
    width: 80px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 15px;
    color: var(--text);
    background: var(--bg);
    outline: none;
    font-family: inherit;
    -webkit-appearance: none;
  }

  .temp-input:focus {
    border-color: var(--period);
  }

  .temp-unit {
    font-size: 14px;
    color: var(--text-muted);
  }

  .note-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 15px;
    color: var(--text);
    resize: none;
    outline: none;
    font-family: inherit;
    background: var(--bg);
    box-sizing: border-box;
    -webkit-appearance: none;
  }

  .note-input:focus {
    border-color: var(--period);
  }
</style>
