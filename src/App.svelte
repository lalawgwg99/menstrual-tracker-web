<script lang="ts">
  import { store } from './lib/store.svelte.js'
  import CalendarView from './components/CalendarView.svelte'
  import LogPanel from './components/LogPanel.svelte'
  import StatsPanel from './components/StatsPanel.svelte'
  import NavBar from './components/NavBar.svelte'

  let activeTab = $state<'calendar' | 'log' | 'stats'>('calendar')

  $effect(() => {
    store.init()
  })
</script>

<div class="app">
  <main class="content">
    {#if activeTab === 'calendar'}
      <CalendarView />
    {:else if activeTab === 'log'}
      <LogPanel />
    {:else}
      <StatsPanel />
    {/if}
  </main>
  <NavBar {activeTab} onTabChange={(tab) => activeTab = tab} />
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
</style>