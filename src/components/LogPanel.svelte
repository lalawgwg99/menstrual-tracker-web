<script lang="ts">
  import { store } from '../lib/store.svelte.js'
  import { addDays } from '../lib/cycle.js'
  import type { FlowLevel, MoodTag, SymptomTag, DailyLog } from '../lib/types.js'
  import ReminderSettings from './ReminderSettings.svelte'

  let showForm = $state(false)
  let startDate = $state('')
  let endDate = $state('')
  let expandedId = $state<string | null>(null)

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
              <div class="entry-dates">{formatDateDisplay(entry.startDate)} — {formatDateDisplay(entry.endDate)}</div>
              <div class="entry-duration">{getDuration(entry)} 天</div>
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
                  <div class="day-header">{formatDateDisplay(date)}</div>

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
    background: white;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 2px 12px rgba(244, 63, 94, 0.08);
  }

  .add-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px;
    background: linear-gradient(135deg, #f43f5e, #fb7185);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .add-btn:hover {
    opacity: 0.9;
  }

  .form-title {
    font-size: 16px;
    font-weight: 600;
    color: #333;
    margin-bottom: 16px;
  }

  .form-group {
    margin-bottom: 12px;
  }

  .form-label {
    display: block;
    font-size: 13px;
    color: #888;
    margin-bottom: 6px;
  }

  .form-input {
    width: 100%;
    padding: 10px 12px;
    border: 1.5px solid #f3e8ee;
    border-radius: 10px;
    font-size: 15px;
    color: #333;
    background: #fdf9fb;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;
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
    background: #f5f5f5;
    color: #888;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    cursor: pointer;
  }

  .btn-save {
    flex: 2;
    padding: 12px;
    background: var(--period);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #666;
    margin-bottom: 12px;
  }

  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid #fce7f0;
  }

  .setting-item:last-child {
    border-bottom: none;
  }

  .setting-label {
    font-size: 14px;
    color: #444;
  }

  .setting-input-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .setting-input {
    width: 60px;
    padding: 6px 10px;
    border: 1.5px solid #f3e8ee;
    border-radius: 8px;
    font-size: 15px;
    text-align: center;
    color: #333;
    outline: none;
  }

  .setting-input:focus {
    border-color: var(--period);
  }

  .setting-unit {
    font-size: 13px;
    color: #aaa;
  }

  .empty-text {
    text-align: center;
    color: #ccc;
    font-size: 13px;
    padding: 20px 0;
  }

  .entries-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .entry-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: #fdf9fb;
    border-radius: 12px;
  }

  .entry-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .entry-info {
    flex: 1;
  }

  .entry-dates {
    font-size: 14px;
    color: #333;
    font-weight: 500;
  }

  .entry-duration {
    font-size: 12px;
    color: #aaa;
    margin-top: 2px;
  }

  .log-btn {
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    transition: background 0.15s;
    line-height: 1;
  }

  .log-btn:hover {
    background: #fce7f0;
  }

  .delete-btn {
    background: none;
    border: none;
    color: #ddd;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    transition: color 0.15s, background 0.15s;
  }

  .delete-btn:hover {
    color: var(--period);
    background: #fde8ee;
  }

  /* Daily log section */
  .daily-logs-section {
    background: #fdf5f8;
    border-radius: 12px;
    padding: 12px;
    margin-top: -4px;
    margin-bottom: 4px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .daily-log-day {
    background: white;
    border-radius: 10px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 1px 4px rgba(244, 63, 94, 0.06);
  }

  .day-header {
    font-size: 13px;
    font-weight: 600;
    color: var(--period);
    padding-bottom: 6px;
    border-bottom: 1px solid #fce7f0;
  }

  .log-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .log-field-label {
    font-size: 12px;
    color: #aaa;
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
    padding: 5px 8px;
    border: 1.5px solid #f3e8ee;
    border-radius: 8px;
    font-size: 14px;
    color: #333;
    outline: none;
    font-family: inherit;
  }

  .temp-input:focus {
    border-color: var(--period);
  }

  .temp-unit {
    font-size: 13px;
    color: #aaa;
  }

  .note-input {
    width: 100%;
    padding: 7px 10px;
    border: 1.5px solid #f3e8ee;
    border-radius: 8px;
    font-size: 13px;
    color: #333;
    resize: none;
    outline: none;
    font-family: inherit;
    background: #fdf9fb;
    box-sizing: border-box;
  }

  .note-input:focus {
    border-color: var(--period);
  }
</style>
