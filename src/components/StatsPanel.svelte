<script lang="ts">
  import { store } from '../lib/store.svelte.js'
  import { getCycleStats, getRecentCycleLengths, getDaysBetween } from '../lib/cycle.js'

  let stats = $derived(getCycleStats(store.entries))
  let recentCycles = $derived(getRecentCycleLengths(store.entries, 6))

  let maxCycleLen = $derived(recentCycles.length > 0 ? Math.max(...recentCycles) : 35)
  let minCycleLen = $derived(recentCycles.length > 0 ? Math.min(...recentCycles) : 21)

  function getBarHeight(len: number): number {
    if (maxCycleLen === minCycleLen) return 60
    return 30 + ((len - minCycleLen) / (maxCycleLen - minCycleLen)) * 50
  }

  let sortedEntries = $derived(
    [...store.entries].sort((a, b) => b.startDate.localeCompare(a.startDate))
  )

  function formatMonth(date: string): string {
    const d = new Date(date + 'T00:00:00')
    return `${d.getMonth() + 1}月`
  }

  function getPeriodDuration(entry: { startDate: string; endDate: string }): number {
    return getDaysBetween(entry.startDate, entry.endDate) + 1
  }
</script>

<div class="stats-panel">
  <!-- Big numbers -->
  <div class="big-stats-grid">
    <div class="card big-stat">
      <div class="big-number">{stats.avgCycle > 0 ? stats.avgCycle : '—'}</div>
      <div class="big-label">平均週期（天）</div>
    </div>
    <div class="card big-stat">
      <div class="big-number period-color">{stats.avgPeriod > 0 ? stats.avgPeriod : '—'}</div>
      <div class="big-label">平均經期（天）</div>
    </div>
  </div>

  <!-- Record count -->
  <div class="card count-card">
    <div class="count-row">
      <span class="count-label">總記錄筆數</span>
      <span class="count-value">{stats.count} 筆</span>
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
            <div class="bar-value">{len}</div>
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
            <div class="recent-index">#{sortedEntries.length - i}</div>
            <div class="recent-info">
              <div class="recent-date">{entry.startDate.replace(/-/g, '/')}</div>
              <div class="recent-meta">{getPeriodDuration(entry)} 天經期</div>
            </div>
            {#if i < sortedEntries.length - 1}
              {@const prevEntry = sortedEntries[i + 1]}
              {@const cycleLen = getDaysBetween(prevEntry.startDate, entry.startDate)}
              {#if cycleLen > 0 && cycleLen < 100}
                <div class="cycle-badge">{cycleLen}天週期</div>
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
    background: white;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 2px 12px rgba(244, 63, 94, 0.08);
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
    color: #a855f7;
    line-height: 1;
  }

  .big-number.period-color {
    color: var(--period);
  }

  .big-label {
    font-size: 12px;
    color: #aaa;
    margin-top: 8px;
  }

  .count-card {
    padding: 14px 16px;
  }

  .count-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .count-label {
    font-size: 14px;
    color: #666;
  }

  .count-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--period);
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #666;
    margin-bottom: 16px;
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
    font-size: 11px;
    color: #aaa;
  }

  .bar {
    width: 24px;
    background: linear-gradient(to top, #f43f5e, #fb7185);
    border-radius: 4px 4px 0 0;
    min-height: 8px;
    transition: height 0.3s ease;
  }

  .bar-label {
    font-size: 10px;
    color: #bbb;
  }

  .chart-note {
    text-align: right;
    font-size: 10px;
    color: #ccc;
    margin-top: 4px;
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .recent-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: #fdf9fb;
    border-radius: 10px;
  }

  .recent-index {
    font-size: 12px;
    color: #ccc;
    width: 24px;
    text-align: center;
  }

  .recent-info {
    flex: 1;
  }

  .recent-date {
    font-size: 14px;
    color: #333;
    font-weight: 500;
  }

  .recent-meta {
    font-size: 11px;
    color: #aaa;
    margin-top: 2px;
  }

  .cycle-badge {
    font-size: 11px;
    color: #a855f7;
    background: rgba(168, 85, 247, 0.1);
    padding: 3px 8px;
    border-radius: 20px;
    white-space: nowrap;
  }

  .empty-card {
    text-align: center;
    padding: 40px 16px;
  }

  .empty-icon {
    font-size: 40px;
    margin-bottom: 12px;
  }

  .empty-text {
    color: #ccc;
    font-size: 14px;
    line-height: 1.6;
  }
</style>