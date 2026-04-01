<script lang="ts">
  import { playTap } from '../lib/sound.js'

  let { activeTab, onTabChange }: {
    activeTab: 'calendar' | 'log' | 'stats'
    onTabChange: (tab: 'calendar' | 'log' | 'stats') => void
  } = $props()

  const tabs = [
    {
      id: 'calendar' as const,
      label: '月曆',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
    },
    {
      id: 'log' as const,
      label: '記錄',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`
    },
    {
      id: 'stats' as const,
      label: '統計',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`
    }
  ]
</script>

<nav class="navbar">
  {#each tabs as tab}
    <button
      class="tab-btn"
      class:active={activeTab === tab.id}
      onclick={() => { playTap(); onTabChange(tab.id) }}
    >
      {@html tab.icon}
      <span>{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  .navbar {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    display: flex;
    background: rgba(255, 255, 255, 0.85); /* Light transparent base */
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-top: 0.5px solid var(--border);
    z-index: 100;
    /* safe area padding to avoid bottom bar collision */
    padding-bottom: env(safe-area-inset-bottom);
  }

  @media (prefers-color-scheme: dark) {
    .navbar {
      background: rgba(28, 28, 30, 0.85);
    }
  }

  /* restrict width if app is centered and max-width is used (as in App.svelte) */
  @media (min-width: 430px) {
    .navbar {
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 430px;
    }
  }

  .tab-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px; /* Slightly more gap for clarity */
    padding: 10px 0 10px; /* Reduced to accommodate safe-area-inset in .navbar */
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 10px; /* Standard iOS bottom tab font size */
    font-weight: 500;
    transition: transform 0.1s, opacity 0.1s;
    -webkit-tap-highlight-color: transparent;
  }

  .tab-btn:active {
    opacity: 0.6;
    transform: scale(0.96);
  }

  .tab-btn.active {
    color: var(--period); /* System red for active tab */
  }

  .tab-btn :global(svg) {
    width: 24px;   /* Standard iOS icon size */
    height: 24px;
    stroke-width: 1.5; /* Lighter stroke for iOS minimal look */
  }
</style>
