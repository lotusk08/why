<script>
  import Icon from './Icon.svelte';
  import { actions, map } from '../lib/map.svelte.js';
  import { flipTheme, theme } from '../lib/theme.svelte.js';
</script>

<header class="topbar">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="https://stevehoang.com"><strong>Steve</strong></a>
    <span class="separator" aria-hidden="true">›</span>
    <span class="current" aria-current="page">Why?</span>
  </nav>

  <div class="actions" role="toolbar" aria-label="Map actions">
    <button
      type="button"
      class="tool"
      title="Undo (⌘Z)"
      aria-label="Undo"
      disabled={!map.canUndo}
      onclick={actions.undo}
    >
      <Icon name="undo" />
    </button>
    <button
      type="button"
      class="tool"
      title="Redo (⇧⌘Z)"
      aria-label="Redo"
      disabled={!map.canRedo}
      onclick={actions.redo}
    >
      <Icon name="redo" />
    </button>
    <span class="dot" aria-hidden="true"></span>
    <button type="button" class="tool" title="Save as image" aria-label="Save as image" onclick={actions.saveImage}>
      <Icon name="download" />
    </button>
    <button type="button" class="tool" title="Copy link" aria-label="Copy link" onclick={actions.share}>
      <Icon name="link" />
    </button>
    <button type="button" class="tool" title="Help" aria-label="Help" onclick={actions.openHelp}>
      <Icon name="help" />
    </button>
    <span class="dot" aria-hidden="true"></span>
    <button type="button" class="tool mode" title="Switch mode" aria-label="Switch mode" onclick={flipTheme}>
      <Icon name="sun" class="mode-icon {theme.mode === 'light' ? 'shown' : ''}" />
      <Icon name="moon" class="mode-icon {theme.mode === 'dark' ? 'shown' : ''}" />
    </button>
  </div>
</header>

<style>
  .topbar {
    position: fixed;
    top: 0;
    right: 0;
    left: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: calc(var(--topbar-height) + var(--safe-top));
    padding: var(--safe-top) clamp(1rem, 4vw, 1.5rem) 0;
    user-select: none;
    -webkit-user-select: none;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    font-size: 1rem;
    line-height: 1.5;
    color: var(--text-muted-color);
    white-space: nowrap;
  }

  .breadcrumb a {
    color: var(--secondary-color);
    transition: color 0.25s ease;
  }

  .breadcrumb a:hover {
    color: var(--primary-color);
  }

  .separator {
    padding: 0 0.3rem;
    font-family: var(--font-ui);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .tool {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    font-size: 0.95rem;
    color: var(--site-btn-color);
    border-radius: 50%;
    transition:
      background-color 0.25s ease,
      color 0.25s ease,
      opacity 0.25s ease;
  }

  .tool:hover,
  .tool:focus-visible {
    color: var(--primary-color);
    background-color: var(--site-hover-bg);
  }

  .tool:disabled {
    opacity: 0.35;
  }

  .tool:disabled:hover {
    color: var(--site-btn-color);
    background-color: transparent;
  }

  .mode {
    margin-left: 0.15rem;
    outline: 1px solid var(--btn-border-color);
  }

  .mode:focus-visible {
    outline: 1px solid var(--primary-color);
  }

  .mode :global(.mode-icon) {
    grid-area: 1 / 1;
    width: 1.1em;
    height: 1.1em;
    opacity: 0;
    transform: rotate(70deg) scale(0.55);
    transition:
      opacity 0.5s cubic-bezier(0.45, 0, 0.55, 1),
      transform 0.5s cubic-bezier(0.45, 0, 0.55, 1);
  }

  .mode :global(.mode-icon.shown) {
    opacity: 1;
    transform: rotate(0) scale(1);
  }

  .dot {
    width: 3px;
    height: 3px;
    margin: 0 0.35rem;
    background-color: var(--site-btn-color);
    border-radius: 50%;
  }

  @media (pointer: coarse) {
    .tool {
      width: 2.25rem;
      height: 2.25rem;
      font-size: 1.05rem;
    }
  }

  @media (max-width: 420px) {
    .dot {
      display: none;
    }

    .actions {
      gap: 0.1rem;
    }
  }
</style>
