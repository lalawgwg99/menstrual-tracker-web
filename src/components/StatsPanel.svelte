<script lang="ts">
  import { store } from '../lib/store.svelte.js'
  import { formatLocalDate, getCycleStats, getRecentCycleLengths, getDaysBetween } from '../lib/cycle.js'
  import type { SymptomTag, PeriodEntry } from '../lib/types.js'
  import { playSuccess, playTap } from '../lib/sound.js'

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  let selectedYear = $state(new Date().getFullYear())
  let selectedMonth = $state<number | null>(null)

  let availableYears = $derived.by(() => {
    const ys = new Set<number>()
    for (const e of store.entries) ys.add(new Date(e.startDate + 'T00:00:00').getFullYear())
    ys.add(new Date().getFullYear())
    return [...ys].sort((a, b) => b - a)
  })

  let filteredEntries = $derived.by(() => {
    return store.entries.filter((e) => {
      const d = new Date(e.startDate + 'T00:00:00')
      const y = d.getFullYear()
      const m = d.getMonth()
      if (y !== selectedYear) return false
      if (selectedMonth !== null && m !== selectedMonth) return false
      return true
    })
  })

  let stats = $derived(getCycleStats(filteredEntries))
  let recentCycles = $derived(getRecentCycleLengths(filteredEntries, 6))

  let maxCycleLen = $derived(recentCycles.length > 0 ? Math.max(...recentCycles) : 35)
  let minCycleLen = $derived(recentCycles.length > 0 ? Math.min(...recentCycles) : 21)

  function getBarHeight(len: number): number {
    if (maxCycleLen === minCycleLen) return 60
    return 30 + ((len - minCycleLen) / (maxCycleLen - minCycleLen)) * 50
  }

  let sortedEntries = $derived(
    [...filteredEntries].sort((a, b) => b.startDate.localeCompare(a.startDate))
  )

  let monthSummary = $derived.by(() => {
    const counts = new Array(12).fill(0)
    for (const e of store.entries) {
      const d = new Date(e.startDate + 'T00:00:00')
      if (d.getFullYear() === selectedYear) counts[d.getMonth()]++
    }
    return counts
  })

  interface TempPoint {
    date: string
    temp: number
    ovulationPositive: boolean
    sex: boolean
    period: boolean
  }

  function getTemperaturePoints(entries: PeriodEntry[]): TempPoint[] {
    const points: TempPoint[] = []
    for (const entry of entries) {
      const logs = entry.logs ?? []
      for (const log of logs) {
        if (typeof log.temperature !== 'number') continue
        points.push({
          date: log.date,
          temp: log.temperature,
          ovulationPositive: log.ovulationTest === 'positive',
          sex: log.sex === true,
          period: log.date >= entry.startDate && log.date <= entry.endDate
        })
      }
    }
    return points.sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
  }

  let tempPoints = $derived(getTemperaturePoints(filteredEntries))
  let tempMin = $derived(tempPoints.length ? Math.min(...tempPoints.map((p) => p.temp)) : 35.5)
  let tempMax = $derived(tempPoints.length ? Math.max(...tempPoints.map((p) => p.temp)) : 37.5)
  let tempPadMin = $derived(Math.floor((tempMin - 0.2) * 10) / 10)
  let tempPadMax = $derived(Math.ceil((tempMax + 0.2) * 10) / 10)

  function getTempY(temp: number): number {
    const max = tempPadMax
    const min = tempPadMin
    const span = Math.max(0.2, max - min)
    return ((max - temp) / span) * 180 + 10
  }

  let tempPolyline = $derived.by(() => {
    if (tempPoints.length === 0) return ''
    const width = 320
    const step = tempPoints.length > 1 ? width / (tempPoints.length - 1) : width
    return tempPoints.map((p, i) => `${i * step},${getTempY(p.temp)}`).join(' ')
  })

  function tempX(index: number): number {
    const width = 320
    if (tempPoints.length <= 1) return width / 2
    return (width / (tempPoints.length - 1)) * index
  }

  function getCycleLengthsAsc() {
    const sortedAsc = [...filteredEntries].sort((a, b) => a.startDate.localeCompare(b.startDate))
    const lengths: number[] = []
    for (let i = 1; i < sortedAsc.length; i++) {
      const diff = getDaysBetween(sortedAsc[i - 1].startDate, sortedAsc[i].startDate)
      if (diff > 0 && diff < 100) lengths.push(diff)
    }
    return lengths
  }

  function getStdDev(values: number[]): number {
    if (values.length === 0) return 0
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length
    return Math.sqrt(variance)
  }

  function getTopSymptom(): { symptom: SymptomTag; count: number } | null {
    const counts = new Map<SymptomTag, number>()
    for (const entry of filteredEntries) {
      for (const log of entry.logs ?? []) {
        for (const s of log.symptoms ?? []) {
          counts.set(s, (counts.get(s) ?? 0) + 1)
        }
      }
    }
    let best: { symptom: SymptomTag; count: number } | null = null
    for (const [symptom, count] of counts.entries()) {
      if (!best || count > best.count) best = { symptom, count }
    }
    return best
  }

  function getSymptomLabel(symptom: SymptomTag): string {
    const map: Record<SymptomTag, string> = {
      cramps: '痛經',
      headache: '頭痛',
      bloating: '腹脹',
      backpain: '腰痛',
      acne: '長痘',
      breast_tenderness: '胸脹',
      nausea: '噁心'
    }
    return map[symptom]
  }

  let insights = $derived.by(() => {
    const items: string[] = []
    const cycleLengths = getCycleLengthsAsc()
    if (cycleLengths.length >= 4) {
      const recent = cycleLengths.slice(-3)
      const prev = cycleLengths.slice(-6, -3)
      if (prev.length === 3) {
        const recentAvg = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
        const prevAvg = Math.round(prev.reduce((a, b) => a + b, 0) / prev.length)
        const diff = recentAvg - prevAvg
        if (diff !== 0) {
          items.push(`近三個週期平均${diff > 0 ? '延長' : '縮短'}了 ${Math.abs(diff)} 天。`)
        }
      }
    }

    const topSymptom = getTopSymptom()
    if (topSymptom && topSymptom.count >= 3) {
      items.push(`你最常記錄的症狀是「${getSymptomLabel(topSymptom.symptom)}」。`)
    }

    if (cycleLengths.length >= 3) {
      const sd = getStdDev(cycleLengths)
      if (sd <= 1.2) {
        items.push('過去的週期規律度很高（偏差值小於 1.2 天）。')
      } else if (sd >= 4) {
        items.push('你的週期變化較大，建議持續觀察並多記錄。')
      }
    }

    return items.slice(0, 3)
  })

  function formatDate(date: string): string {
    const d = new Date(date + 'T00:00:00')
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }

  function getEntriesWithinMonths(months: number) {
    const now = new Date()
    const start = new Date(now)
    start.setMonth(now.getMonth() - months)
    return store.entries.filter((e) => new Date(e.startDate + 'T00:00:00') >= start)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }

  function getTopSymptomsInEntries(entries: PeriodEntry[]) {
    const counts = new Map<SymptomTag, number>()
    for (const entry of entries) {
      for (const log of entry.logs ?? []) {
        for (const s of log.symptoms ?? []) {
          counts.set(s, (counts.get(s) ?? 0) + 1)
        }
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([symptom, count]) => ({ label: getSymptomLabel(symptom), count }))
  }

  function exportDoctorReport() {
    playSuccess()
    const entries = getEntriesWithinMonths(6)
    const statsLocal = getCycleStats(entries)
    const topSymptoms = getTopSymptomsInEntries(entries)
    const periodRows = entries.map((e) => {
      const duration = getDaysBetween(e.startDate, e.endDate) + 1
      return `<tr>
        <td>${formatDate(e.startDate)}</td>
        <td>${formatDate(e.endDate)}</td>
        <td>${duration}</td>
      </tr>`
    }).join('')

    const todayStr = formatDate(formatLocalDate(new Date()))
    const symptomLine = topSymptoms.length
      ? topSymptoms.map((s) => `${s.label} (${s.count})`).join('、')
      : '無'

    const html = `<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <title>週期日記｜看診報表</title>
  <style>
    body { font-family: -apple-system, "SF Pro Text", system-ui, sans-serif; color: #111; margin: 0; }
    .page { padding: 32px 36px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    .meta { font-size: 12px; color: #666; margin-bottom: 24px; }
    .section { margin-bottom: 20px; }
    .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .summary-card { border: 1px solid #ddd; border-radius: 10px; padding: 10px 12px; }
    .summary-value { font-size: 18px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #eee; }
    th { color: #666; font-weight: 600; }
    .note { font-size: 12px; color: #444; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="page">
    <h1>看診報表（近六個月）</h1>
    <div class="meta">產生日期：${todayStr}</div>

    <div class="section">
      <div class="label">週期摘要</div>
      <div class="summary">
        <div class="summary-card">
          <div class="summary-value">${statsLocal.avgCycle || '—'}</div>
          <div>平均週期（天）</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${statsLocal.avgPeriod || '—'}</div>
          <div>平均經期（天）</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${statsLocal.count}</div>
          <div>記錄筆數</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="label">常見症狀</div>
      <div class="note">${symptomLine}</div>
    </div>

    <div class="section">
      <div class="label">經期記錄</div>
      <table>
        <thead>
          <tr>
            <th>開始</th>
            <th>結束</th>
            <th>天數</th>
          </tr>
        </thead>
        <tbody>
          ${periodRows || '<tr><td colspan=\"3\">尚無紀錄</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.open()
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }

  function formatMonth(date: string): string {
    const d = new Date(date + 'T00:00:00')
    return `${d.getMonth() + 1}月`
  }

  function getPeriodDuration(entry: { startDate: string; endDate: string }): number {
    return getDaysBetween(entry.startDate, entry.endDate) + 1
  }

  function selectYear(y: number) {
    selectedYear = y
    selectedMonth = null
  }

  function selectMonth(m: number) {
    selectedMonth = selectedMonth === m ? null : m
  }
</script>

<div class="stats-panel">
  <div class="card year-view-card">
    <div class="year-header">
      <h3 class="section-title">年份日曆</h3>
      <div class="year-tabs">
        {#each availableYears as y}
          <button
            class="year-btn num-rounded"
            class:active={selectedYear === y}
            onclick={() => { playTap(); selectYear(y) }}
          >{y}</button>
        {/each}
      </div>
    </div>
    <div class="month-grid">
      {#each monthNames as m, i}
        <button
          class="month-cell"
          class:active={selectedMonth === i}
          onclick={() => { playTap(); selectMonth(i) }}
        >
          <span class="month-name">{m}</span>
          <span class="month-count num-rounded">{monthSummary[i]} 筆</span>
        </button>
      {/each}
    </div>
    <div class="filter-note">
      目前篩選：
      <span class="num-rounded">{selectedYear} 年</span>
      {#if selectedMonth !== null}
        <span> / {monthNames[selectedMonth]}</span>
      {:else}
        <span> / 全年</span>
      {/if}
    </div>
    <p class="simple-hint">點月份可快速縮小資料範圍，再往下看該期間的體溫與週期趨勢。</p>
  </div>

  {#if tempPoints.length > 0}
    <div class="card temp-card">
      <h3 class="section-title">體溫曲線整合</h3>
      <div class="temp-chart-wrap">
        <svg viewBox="0 0 330 200" class="temp-chart" aria-label="體溫曲線">
          <line x1="0" y1="10" x2="0" y2="190" class="temp-axis" />
          <line x1="0" y1="190" x2="320" y2="190" class="temp-axis" />
          <polyline points={tempPolyline} class="temp-line"></polyline>

          {#each tempPoints as p, i}
            <circle
              cx={tempX(i)}
              cy={getTempY(p.temp)}
              r="3.6"
              class="temp-dot {p.period ? 'period-dot' : ''}"
            />
            {#if p.ovulationPositive}
              <rect
                x={tempX(i) - 3}
                y={getTempY(p.temp) - 14}
                width="6"
                height="6"
                class="ov-test-dot"
              />
            {/if}
            {#if p.sex}
              <circle
                cx={tempX(i)}
                cy={getTempY(p.temp) + 12}
                r="2.8"
                class="sex-dot"
              />
            {/if}
          {/each}
        </svg>
      </div>
      <div class="temp-labels num-rounded">
        <span>{tempPadMax.toFixed(1)}°C</span>
        <span>{tempPadMin.toFixed(1)}°C</span>
      </div>
      <div class="temp-legend">
        <span class="legend-item"><i class="legend period"></i>經期</span>
        <span class="legend-item"><i class="legend ov"></i>排卵試紙陽性</span>
        <span class="legend-item"><i class="legend sex"></i>性行為</span>
      </div>
      <div class="chart-note">顯示最近 30 筆體溫紀錄（依目前篩選）</div>
    </div>
  {/if}

  <!-- Big numbers -->
  <div class="big-stats-grid">
    <div class="card big-stat">
      <div class="big-number num-rounded">{stats.avgCycle > 0 ? stats.avgCycle : '—'}</div>
      <div class="big-label">平均週期（天）</div>
    </div>
    <div class="card big-stat">
      <div class="big-number period-color num-rounded">{stats.avgPeriod > 0 ? stats.avgPeriod : '—'}</div>
      <div class="big-label">平均經期（天）</div>
    </div>
  </div>

  <!-- Record count -->
  <div class="card count-card">
    <div class="count-row">
      <span class="count-label">總記錄筆數</span>
      <span class="count-value num-rounded">{stats.count} 筆</span>
    </div>
    <div class="count-actions">
      <button class="report-btn" onclick={exportDoctorReport}>匯出看診報表</button>
      {#if insights.length > 0}
        <p class="count-insight">{insights[0]}</p>
      {:else}
        <p class="count-insight">記錄越完整，分析會越準。</p>
      {/if}
    </div>
  </div>

  <!-- Recent cycles chart -->
  {#if recentCycles.length > 0}
    <div class="card">
      <h3 class="section-title">近期週期長度</h3>
      <div class="bar-chart">
        {#each recentCycles as len, i}
          {@const entry = sortedEntries[recentCycles.length - 1 - i]}
          <div class="bar-column">
            <div class="bar-value num-rounded">{len}</div>
            <div
              class="bar"
              style="height: {getBarHeight(len)}px"
            ></div>
            <div class="bar-label">{entry ? formatMonth(entry.startDate) : ''}</div>
          </div>
        {/each}
      </div>
      <div class="chart-note">天數</div>
    </div>
  {/if}

  <!-- Recent entries summary -->
  {#if sortedEntries.length > 0}
    <div class="card">
      <h3 class="section-title">最近記錄</h3>
      <div class="recent-list">
        {#each sortedEntries.slice(0, 5) as entry, i}
          <div class="recent-item">
            <div class="recent-index num-rounded">#{sortedEntries.length - i}</div>
            <div class="recent-info">
              <div class="recent-date">{entry.startDate.replace(/-/g, '/')}</div>
              <div class="recent-meta num-rounded">{getPeriodDuration(entry)} 天經期</div>
            </div>
            {#if i < sortedEntries.length - 1}
              {@const prevEntry = sortedEntries[i + 1]}
              {@const cycleLen = getDaysBetween(prevEntry.startDate, entry.startDate)}
              {#if cycleLen > 0 && cycleLen < 100}
                <div class="cycle-badge num-rounded">{cycleLen}天週期</div>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="card empty-card">
      <div class="empty-icon">📊</div>
      <p class="empty-text">記錄兩次以上的經期<br>即可查看統計數據</p>
    </div>
  {/if}
</div>

<style>
  .stats-panel {
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

  .year-view-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .year-header {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .year-tabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .year-btn {
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text-muted);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 13px;
    white-space: nowrap;
  }

  .year-btn.active {
    background: var(--text);
    color: var(--bg);
    border-color: var(--text);
  }

  .month-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .month-cell {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg);
    text-align: left;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .month-cell.active {
    border-color: var(--period);
    background: rgba(255, 59, 48, 0.08);
  }

  .month-name {
    font-size: 13px;
    color: var(--text);
    font-weight: 600;
  }

  .month-count {
    font-size: 12px;
    color: var(--text-muted);
  }

  .filter-note {
    font-size: 12px;
    color: var(--text-muted);
  }

  .temp-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .temp-chart-wrap {
    width: 100%;
    overflow-x: auto;
  }

  .temp-chart {
    width: 100%;
    min-width: 330px;
    height: 200px;
  }

  .temp-axis {
    stroke: var(--border);
    stroke-width: 1;
  }

  .temp-line {
    fill: none;
    stroke: var(--ovulation);
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .temp-dot {
    fill: var(--ovulation);
  }

  .temp-dot.period-dot {
    fill: var(--period);
  }

  .ov-test-dot {
    fill: var(--fertile);
    rx: 1.5px;
  }

  .sex-dot {
    fill: var(--text);
    opacity: 0.85;
  }

  .temp-labels {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-muted);
  }

  .temp-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .legend {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    display: inline-block;
  }

  .legend.period {
    background: var(--period);
  }

  .legend.ov {
    background: var(--fertile);
    border-radius: 2px;
  }

  .legend.sex {
    background: var(--text);
  }

  .big-stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .big-stat {
    text-align: center;
    padding: 20px 16px;
  }

  .big-number {
    font-size: 48px;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
    letter-spacing: -1px;
  }

  .big-number.period-color {
    color: var(--period);
  }

  .big-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    margin-top: 8px;
  }

  .count-card {
    padding: 14px 16px 16px;
  }

  .count-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .count-label {
    font-size: 16px;
    color: var(--text);
  }

  .count-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--period);
  }

  .report-btn {
    border: none;
    padding: 8px 14px;
    border-radius: 10px;
    background: var(--accent);
    color: var(--bg);
    font-size: 13px;
    font-weight: 600;
  }

  .report-btn:active {
    opacity: 0.7;
  }

  .count-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 12px;
  }

  .count-insight {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .section-title {
    font-size: 13px;
    font-weight: 500;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 16px;
    padding-left: 4px;
  }

  .bar-chart {
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    height: 100px;
    padding: 0 8px;
  }

  .bar-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .bar-value {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .bar {
    width: 24px;
    background: var(--period);
    border-radius: 6px 6px 0 0;
    min-height: 8px;
    transition: height 0.3s ease;
    opacity: 0.8;
  }

  .bar-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .chart-note {
    text-align: right;
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 8px;
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    border-radius: 12px;
    overflow: hidden;
  }

  .recent-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 0.5px solid var(--border);
  }
  .recent-item:last-child {
    border-bottom: none;
  }

  .recent-index {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-muted);
    width: 28px;
    text-align: center;
  }

  .recent-info {
    flex: 1;
  }

  .recent-date {
    font-size: 16px;
    color: var(--text);
    font-weight: 500;
  }

  .recent-meta {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .cycle-badge {
    font-size: 13px;
    color: var(--text-muted);
    background: var(--bg);
    padding: 4px 10px;
    border-radius: 20px;
    white-space: nowrap;
    border: 1px solid var(--border);
  }

  .empty-card {
    text-align: center;
    padding: 40px 16px;
  }

  .empty-icon {
    font-size: 40px;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .empty-text {
    color: var(--text-muted);
    font-size: 15px;
    line-height: 1.6;
  }
</style>
