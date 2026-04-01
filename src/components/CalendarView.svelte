<script lang="ts">
  import { store } from '../lib/store.svelte.js'
  import { getDayStatus, getPredictions, getDaysBetween, getCurrentCycleDay, today, addDays, getDetailedPhase, getCycleConfidence } from '../lib/cycle.js'
  import type { FlowLevel } from '../lib/types.js'

  let { onNavigate } = $props<{
    onNavigate?: (tab: 'calendar' | 'log' | 'stats') => void
  }>()

  let currentYear = $state(new Date().getFullYear())
  let currentMonth = $state(new Date().getMonth()) // 0-indexed
  let isExpanded = $state(false)

  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

  let calendarDays = $derived.by(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const days: (string | null)[] = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const month = String(currentMonth + 1).padStart(2, '0')
      const day = String(d).padStart(2, '0')
      days.push(`${currentYear}-${month}-${day}`)
    }
    
    if (isExpanded) return days

    const tStr = today()
    let targetIndex = days.indexOf(tStr)
    if (targetIndex === -1) {
      // Find the first valid week to show
      targetIndex = days.findIndex(d => d !== null)
      if (targetIndex === -1) targetIndex = 0
    }
    const rowStart = Math.floor(targetIndex / 7) * 7
    return days.slice(rowStart, rowStart + 7)
  })

  let defaults = $derived({ cycleLength: store.cycleLength, periodLength: store.periodLength })
  let predictions = $derived(getPredictions(store.entries, defaults))
  let confidence = $derived(getCycleConfidence(store.entries, defaults))
  let cycleDay = $derived(getCurrentCycleDay(store.entries))
  let todayStr = $derived(today())
  let phase = $derived(getDetailedPhase(store.entries, defaults))
  let activeEntry = $derived(
    store.entries.find(e => todayStr >= e.startDate && todayStr <= e.endDate) ?? null
  )
  let lastEntry = $derived(
    store.entries.length > 0
      ? [...store.entries].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
      : null
  )
  let rangeStart = $derived(
    lastEntry && confidence ? addDays(lastEntry.startDate, confidence.range.min) : null
  )
  let rangeEnd = $derived(
    lastEntry && confidence ? addDays(lastEntry.startDate, confidence.range.max) : null
  )
  let remainingPeriodDays = $derived(
    activeEntry ? getDaysBetween(todayStr, activeEntry.endDate) + 1 : null
  )

  const flowOptions: { value: FlowLevel; label: string }[] = [
    { value: 'spotting', label: '點滴' },
    { value: 'light', label: '輕' },
    { value: 'medium', label: '中' },
    { value: 'heavy', label: '重' }
  ]

  function getTodayFlow(): FlowLevel | undefined {
    if (!activeEntry) return undefined
    return store.getDailyLog(activeEntry.id, todayStr)?.flow
  }

  function setTodayFlow(flow: FlowLevel) {
    if (!activeEntry) return
    const existing = store.getDailyLog(activeEntry.id, todayStr) ?? { date: todayStr }
    const nextFlow = existing.flow === flow ? undefined : flow
    store.upsertDailyLog(activeEntry.id, { ...existing, flow: nextFlow })
  }

  function goToLog() {
    onNavigate?.('log')
  }

  function prevMonth() {
    if (currentMonth === 0) { currentMonth = 11; currentYear-- }
    else { currentMonth-- }
  }

  function nextMonth() {
    if (currentMonth === 11) { currentMonth = 0; currentYear++ }
    else { currentMonth++ }
  }
</script>

<div class="calendar-view">
  
  {#if phase}
  <div class="dashboard-header">
    <div class="ring-container">
      <svg viewBox="0 0 120 120" class="progress-ring">
        <circle cx="60" cy="60" r="50" class="ring-bg" />
        <circle cx="60" cy="60" r="50" class="ring-progress" 
          style="stroke: {phase.colorVar}; stroke-dashoffset: {314.159 * (1 - phase.progress)}" 
        />
      </svg>
      <div class="ring-center">
        <span class="phase-name" style="color: {phase.colorVar}">{phase.name}</span>
        <span class="day-count num-rounded">週期第 {cycleDay} 天</span>
      </div>
    </div>

    <div class="insight-box">
      <div class="insight-icon">✨</div>
      <p class="insight-text">{phase.insight}</p>
    </div>

    <div class="context-card">
      {#if activeEntry}
        <div class="context-title">今天是經期第 {getDaysBetween(activeEntry.startDate, todayStr) + 1} 天</div>
        {#if remainingPeriodDays !== null}
          <div class="context-sub">預計還剩 {remainingPeriodDays} 天</div>
        {/if}
        <div class="flow-quick">
          <div class="flow-label">快速記錄經血量</div>
          <div class="flow-buttons">
            {#each flowOptions as opt}
              <button
                class="flow-btn {getTodayFlow() === opt.value ? 'active' : ''}"
                onclick={() => setTodayFlow(opt.value)}
              >{opt.label}</button>
            {/each}
          </div>
        </div>
      {:else if phase.name === '黃體期'}
        <div class="context-title">經前期小提示</div>
        <div class="context-sub">如果有情緒或身體不適，記錄下來會更容易看出規律。</div>
        <button class="context-action" onclick={goToLog}>前往記錄</button>
      {:else if phase.name === '濾泡期'}
        <div class="context-title">留白日常</div>
        <div class="context-sub">
          {#if predictions}
            距離下次經期還有 {getDaysBetween(todayStr, predictions.nextPeriod)} 天
          {:else}
            完成第一次記錄後會出現預測
          {/if}
        </div>
      {:else}
        <div class="context-title">保持節奏</div>
        <div class="context-sub">用最少的記錄，掌握身體的變化。</div>
      {/if}
    </div>
  </div>
  {/if}

  <div class="card calendar-card">
    <div class="month-nav">
      <button class="nav-btn" aria-label="上個月" onclick={prevMonth}>‹</button>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <h2 class="month-title" onclick={() => isExpanded = !isExpanded} style="cursor: pointer;">
        {currentYear}年 {monthNames[currentMonth]}
        <span class="expand-icon">{isExpanded ? '⌃' : '⌄'}</span>
      </h2>
      <button class="nav-btn" aria-label="下個月" onclick={nextMonth}>›</button>
    </div>

    <div class="weekday-grid">
      {#each weekdays as wd}
        <div class="weekday-label">{wd}</div>
      {/each}
    </div>

    <div class="days-grid">
      {#each calendarDays as date}
        {#if date === null}
          <div class="day-cell empty"></div>
        {:else}
          {@const status = getDayStatus(date, store.entries, defaults)}
          {@const dayNum = parseInt(date.split('-')[2])}
          <div
            class="day-cell"
            class:period={status === 'period'}
            class:ovulation={status === 'ovulation'}
            class:fertile={status === 'fertile'}
            class:predicted-period={status === 'predicted-period'}
            class:predicted-fertile={status === 'predicted-fertile'}
            class:predicted-ovulation={status === 'predicted-ovulation'}
            class:predicted-range={confidence && confidence.score < 40 && rangeStart && rangeEnd && (date === rangeStart || date === rangeEnd) && status !== 'period'}
            class:predicted-range-light={confidence && confidence.score < 40 && status === 'predicted-period'}
            class:is-today={date === todayStr}
          >
            <span class="day-num num-rounded">{dayNum}</span>
          </div>
        {/if}
      {/each}
    </div>
  </div>

  {#if predictions && confidence}
    <div class="card prediction-card">
      <div class="prediction-row">
        <div class="prediction-label">下次經期預測</div>
        <div class="prediction-date num-rounded">
          {predictions.nextPeriod.replace(/-/g, '/')}
        </div>
      </div>
      <div class="prediction-row">
        <div class="prediction-label">預測範圍</div>
        <div class="prediction-range num-rounded">
          {confidence.range.min}–{confidence.range.max} 天週期
        </div>
      </div>
      <div class="confidence-row">
        <div class="confidence-label">信心指數</div>
        <div class="confidence-track">
          <div class="confidence-fill" style="width: {confidence.score}%"></div>
        </div>
        <div class="confidence-score num-rounded">{confidence.score}%</div>
      </div>
      <div class="confidence-note">
        {#if confidence.count < 3}
          需要更多記錄才能提升準確度
        {:else}
          週期越規律，預測越可靠
        {/if}
      </div>
    </div>
  {/if}

  {#if !predictions}
    <div class="card">
      <p class="no-data">記錄第一次經期後，即可解鎖週期預測與分析</p>
    </div>
  {/if}
</div>

<style>
  .calendar-view {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-top: 10px;
  }

  /* Dashboard Header */
  .dashboard-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    margin-bottom: 8px;
  }

  .ring-container {
    position: relative;
    width: 140px;
    height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .progress-ring {
    position: absolute;
    top: -10px;
    left: -10px;
    width: 160px;
    height: 160px;
    transform: rotate(-90deg);
  }

  .ring-bg {
    fill: none;
    stroke: var(--border);
    stroke-width: 12;
  }

  .ring-progress {
    fill: none;
    stroke-width: 12;
    stroke-linecap: round;
    stroke-dasharray: 314.159; /* 2 * pi * 50 */
    transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ring-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 10;
  }

  .phase-name {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .day-count {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .insight-box {
    background: var(--card-bg);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    box-shadow: var(--shadow);
    width: 100%;
    box-sizing: border-box;
  }

  .insight-icon {
    font-size: 20px;
  }

  .insight-text {
    flex: 1;
    font-size: 15px;
    color: var(--text);
    line-height: 1.5;
    font-weight: 500;
  }

  .context-card {
    width: 100%;
    background: var(--card-bg);
    border-radius: 18px;
    padding: 16px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .context-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
  }

  .context-sub {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.45;
  }

  .flow-quick {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .flow-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .flow-buttons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .flow-btn {
    border: 1px solid var(--border);
    background: var(--bg);
    border-radius: 10px;
    padding: 10px 0;
    font-size: 13px;
    color: var(--text);
    transition: transform 0.12s, opacity 0.12s, background 0.12s;
  }

  .flow-btn:active {
    opacity: 0.7;
    transform: scale(0.98);
  }

  .flow-btn.active {
    background: var(--period);
    border-color: var(--period);
    color: white;
  }

  .context-action {
    align-self: flex-start;
    padding: 8px 12px;
    border-radius: 10px;
    border: none;
    background: var(--text);
    color: var(--bg);
    font-size: 13px;
    font-weight: 600;
  }

  /* Calendar Card */
  .card {
    background: var(--card-bg);
    border-radius: 14px;
    padding: 16px;
    box-shadow: var(--shadow);
  }

  .calendar-card {
    transition: all 0.3s ease;
  }

  .prediction-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .prediction-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .prediction-label {
    font-size: 13px;
    color: var(--text-muted);
  }

  .prediction-date {
    font-size: 17px;
    font-weight: 600;
    color: var(--text);
  }

  .prediction-range {
    font-size: 14px;
    color: var(--text);
  }

  .confidence-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 10px;
  }

  .confidence-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .confidence-track {
    height: 6px;
    background: var(--border);
    border-radius: 999px;
    overflow: hidden;
  }

  .confidence-fill {
    height: 100%;
    background: var(--ovulation);
    border-radius: 999px;
    transition: width 0.4s ease;
  }

  .confidence-score {
    font-size: 12px;
    color: var(--text-muted);
  }

  .confidence-note {
    font-size: 12px;
    color: var(--text-muted);
  }

  .month-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding: 0 4px;
  }

  .month-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 6px;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .expand-icon {
    font-size: 14px;
    color: var(--text-muted);
    font-weight: 400;
  }

  .nav-btn {
    background: none;
    border: none;
    font-size: 24px;
    color: var(--period);
    cursor: pointer;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: opacity 0.1s;
    -webkit-tap-highlight-color: transparent;
  }

  .nav-btn:active {
    opacity: 0.5;
  }

  .weekday-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: 8px;
  }

  .weekday-label {
    text-align: center;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    padding: 4px 0;
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px; /* Slightly looser for cleaner Apple look */
  }

  .day-cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    cursor: pointer;
    transition: opacity 0.15s;
    position: relative;
  }

  .day-cell.empty { cursor: default; }

  .day-num {
    font-size: 16px;
    color: var(--text);
    position: relative;
    z-index: 1;
    font-weight: 500;
  }

  .day-cell.period { background: var(--period); }
  .day-cell.period .day-num { color: white; font-weight: 600; }

  .day-cell.predicted-period::after {
    content: '';
    position: absolute;
    bottom: 4px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--period);
    opacity: 0.8;
  }

  .day-cell.ovulation { background: var(--ovulation); }
  .day-cell.ovulation .day-num { color: white; font-weight: 600; }

  .day-cell.predicted-ovulation::after {
    content: '';
    position: absolute;
    bottom: 4px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--ovulation);
    opacity: 0.8;
  }

  .day-cell.fertile { background: var(--fertile); }
  .day-cell.fertile .day-num { color: white; font-weight: 600; }

  .day-cell.predicted-fertile::after {
    content: '';
    position: absolute;
    bottom: 4px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--fertile);
    opacity: 0.8;
  }

  .day-cell.predicted-range::after {
    content: '';
    position: absolute;
    inset: 6px;
    border-radius: 50%;
    border: 1.5px dashed rgba(255, 59, 48, 0.6);
    pointer-events: none;
  }

  .day-cell.predicted-range.predicted-range-light::after {
    inset: 7px;
    border-width: 1px;
    border-color: rgba(255, 59, 48, 0.35);
  }

  .day-cell.is-today:not(.period):not(.ovulation):not(.fertile) .day-num {
    color: var(--period);
    font-weight: bold;
  }
  .day-cell.is-today:not(.period):not(.ovulation):not(.fertile) {
    background: transparent;
  }
  .day-cell.is-today.period,
  .day-cell.is-today.ovulation,
  .day-cell.is-today.fertile {
    box-shadow: inset 0 0 0 2px var(--card-bg);
  }

  .no-data {
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
    padding: 16px 0;
  }
</style>
