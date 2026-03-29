<script lang="ts">
  import { store } from '../lib/store.svelte.js'
  import { addDays } from '../lib/cycle.js'

  let showForm = $state(false)
  let startDate = $state('')
  let endDate = $state('')

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
            <button class="delete-btn" onclick={() => handleDelete(entry.id)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
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
</style>