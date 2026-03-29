<script lang="ts">
  import { store } from '../lib/store.svelte.js'
  import { getDayStatus, getPredictions, getDaysBetween, getCurrentCycleDay, today, addDays } from '../lib/cycle.js'

  let currentYear = $state(new Date().getFullYear())
  let currentMonth = $state(new Date().getMonth()) // 0-indexed

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
    return days
  })

  let defaults = $derived({ cycleLength: store.cycleLength, periodLength: store.periodLength })
  let predictions = $derived(getPredictions(store.entries, defaults))
  let cycleDay = $derived(getCurrentCycleDay(store.entries))
  let todayStr = $derived(today())

  // $derived.by for multi-statement derivations
  let daysUntilNext = $derived.by(() => {
    if (!predictions) return null
    return getDaysBetween(todayStr, predictions.nextPeriod)
  })

  function prevMonth() {
    if (currentMonth === 0) { currentMonth = 11; currentYear-- }
    else { currentMonth-- }
  }

  function nextMonth() {
    if (currentMonth === 11) { currentMonth = 0; currentYear++ }
    else { currentMonth++ }
  }

  function formatDate(date: string): string {
    const d = new Date(date + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
</script>

<div class="calendar-view">
  <div class="card">
    <div class="month-nav">
      <button class="nav-btn" onclick={prevMonth}>‹</button>
      <h2 class="month-title">{currentYear}年 {monthNames[currentMonth]}</h2>
      <button class="nav-btn" onclick={nextMonth}>›</button>
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
            class:is-today={date === todayStr}
          >
            <span class="day-num">{dayNum}</span>
          </div>
        {/if}
      {/each}
    </div>

    <div class="legend">
      <div class="legend-item"><span class="dot period-dot"></span>經期</div>
      <div class="legend-item"><span class="dot predicted-dot"></span>預測經期</div>
      <div class="legend-item"><span class="dot fertile-dot"></span>易孕期</div>
      <div class="legend-item"><span class="dot ovulation-dot"></span>排卵日</div>
    </div>
  </div>

  <div class="card status-card">
    <h3 class="status-title">今日狀態</h3>
    <div class="status-grid">
      <div class="status-item">
        <span class="status-number">{cycleDay !== null ? cycleDay : '—'}</span>
        <span class="status-label">週期第幾天</span>
      </div>
      <div class="status-item">
        <span
          class="status-number"
          class:soon={daysUntilNext !== null && daysUntilNext <= 3}
        >
          {daysUntilNext !== null && daysUntilNext >= 0 ? daysUntilNext : '—'}
        </span>
        <span class="status-label">距下次經期（天）</span>
      </div>
    </div>

    {#if predictions}
      <div class="predictions">
        <div class="pred-item">
          <span class="pred-label">預測下次經期</span>
          <span class="pred-date period-text">{formatDate(predictions.nextPeriod)}</span>
        </div>
        <div class="pred-item">
          <span class="pred-label">排卵日</span>
          <span class="pred-date ovulation-text">{formatDate(predictions.ovulation)}</span>
        </div>
        <div class="pred-item">
          <span class="pred-label">易孕期</span>
          <span class="pred-date fertile-text">{formatDate(predictions.fertileStart)} — {formatDate(predictions.fertileEnd)}</span>
        </div>
      </div>
    {:else}
      <p class="no-data">記錄第一次經期後，即可查看預測</p>
    {/if}
  </div>
</div>

<style>
  .calendar-view {
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

  .month-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .month-title {
    font-size: 17px;
    font-weight: 600;
    color: #333;
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
    transition: background 0.15s;
  }

  .nav-btn:hover { background: #fde8ee; }

  .weekday-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: 4px;
  }

  .weekday-label {
    text-align: center;
    font-size: 12px;
    color: #aaa;
    padding: 4px 0;
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }

  .day-cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .day-cell.empty { cursor: default; }

  .day-num {
    font-size: 13px;
    color: #444;
    position: relative;
    z-index: 1;
  }

  .day-cell.period { background: var(--period); }
  .day-cell.period .day-num { color: white; }

  .day-cell.predicted-period { border: 2px dashed var(--period); background: rgba(244,63,94,0.08); }
  .day-cell.predicted-period .day-num { color: var(--period); }

  .day-cell.ovulation { background: var(--ovulation); }
  .day-cell.ovulation .day-num { color: white; }

  .day-cell.predicted-ovulation { border: 2px dashed var(--ovulation); background: rgba(168,85,247,0.1); }
  .day-cell.predicted-ovulation .day-num { color: var(--ovulation); }

  .day-cell.fertile { background: var(--fertile); }
  .day-cell.fertile .day-num { color: white; }

  .day-cell.predicted-fertile { border: 2px dashed var(--fertile); background: rgba(251,146,60,0.1); }
  .day-cell.predicted-fertile .day-num { color: var(--fertile); }

  .day-cell.is-today:not(.period):not(.ovulation):not(.fertile) { border: 2px solid #333; }
  .day-cell.is-today.period,
  .day-cell.is-today.ovulation,
  .day-cell.is-today.fertile { outline: 2px solid #333; outline-offset: 1px; }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #fce7f0;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #888;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .period-dot { background: var(--period); }
  .predicted-dot { background: rgba(244,63,94,0.2); border: 1.5px dashed var(--period); }
  .fertile-dot { background: var(--fertile); }
  .ovulation-dot { background: var(--ovulation); }

  .status-title {
    font-size: 14px;
    font-weight: 600;
    color: #666;
    margin-bottom: 12px;
  }

  .status-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }

  .status-item {
    background: #fdf2f8;
    border-radius: 12px;
    padding: 12px;
    text-align: center;
  }

  .status-number {
    display: block;
    font-size: 32px;
    font-weight: 700;
    color: var(--period);
    line-height: 1.1;
  }

  .status-number.soon { color: #f97316; }

  .status-label {
    display: block;
    font-size: 11px;
    color: #aaa;
    margin-top: 4px;
  }

  .predictions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pred-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #fdf9ff;
    border-radius: 10px;
  }

  .pred-label { font-size: 13px; color: #888; }
  .pred-date { font-size: 13px; font-weight: 600; }
  .period-text { color: var(--period); }
  .ovulation-text { color: var(--ovulation); }
  .fertile-text { color: var(--fertile); }

  .no-data {
    text-align: center;
    color: #ccc;
    font-size: 13px;
    padding: 16px 0;
  }
</style>
