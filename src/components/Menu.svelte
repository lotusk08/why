<script>
  import { tick } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { slide } from 'svelte/transition';
  import Icon from './Icon.svelte';
  import { actions, map, ui } from '../lib/map.svelte.js';
  import { flipTheme, theme } from '../lib/theme.svelte.js';
  import { reducedMotion } from '../lib/reasons/motion.js';

  const SHORTCUTS = {
    share: { key: 'l', shift: true, label: '⇧⌘L' },
    savePng: { key: 's', shift: true, label: '⇧⌘S' },
    saveSvg: { key: 's', shift: false, label: '⌘S' },
    savePdf: { key: 'p', shift: false, label: '⌘P' }
  };

  let tips = $state(false);
  let open = $state(null);
  let toolbar = $state(null);

  const sheets = $derived({
    map: [
      { icon: 'eraser', label: 'Clear the map', disabled: !map.nodes, action: 'clear' },
      { icon: 'lightbulb', label: 'Reset to demo', action: 'reset' }
    ],
    share: [
      { icon: 'link', label: 'Copy link', action: 'share' },
      { icon: 'image', label: 'Save as PNG', action: 'savePng' },
      { icon: 'vector', label: 'Save as SVG', action: 'saveSvg' },
      { icon: 'pdf', label: 'Save as PDF', action: 'savePdf' }
    ]
  });

  function reveal(node) {
    const base = slide(node, { axis: 'x', duration: reducedMotion() ? 0 : 200, easing: cubicOut });
    return { ...base, css: (t, u) => `${base.css(t, u)} opacity: ${t};` };
  }

  function cycle(list, current, delta) {
    const index = list.indexOf(current);
    return list[(index + delta + list.length) % list.length];
  }

  async function toggle(name, event) {
    open = open === name ? null : name;
    if (!open || event.detail !== 0) return;
    await tick();
    toolbar.querySelector(`#menu-${name} .choice:not(:disabled)`)?.focus();
  }

  function choose(item) {
    open = null;
    actions[item.action]();
  }

  function onItemKey(event) {
    const items = [...toolbar.querySelectorAll('.item')];
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -items.indexOf(event.target) - 1, End: items.length };
    if (event.key in moves) {
      event.preventDefault();
      const target = ['Home', 'End'].includes(event.key) ? items.at(event.key === 'Home' ? 0 : -1) : null;
      (target ?? cycle(items, event.target, moves[event.key])).focus();
    } else if (event.key === 'Escape' && !open) {
      actions.focusMap();
    }
  }

  function onChoiceKey(event, choice) {
    const group = choice.closest('[data-sheet]');
    const choices = [...group.querySelectorAll('.choice:not(:disabled)')];
    const moves = { ArrowUp: -1, ArrowDown: 1 };
    if (event.key in moves) {
      event.preventDefault();
      cycle(choices, choice, moves[event.key]).focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      open = null;
      group.querySelector('.item').focus();
    }
  }

  function onMenuKey(event) {
    const choice = event.target.closest('.choice');
    if (choice) onChoiceKey(event, choice);
    else if (event.target.matches('.item')) onItemKey(event);
  }

  function onSheetFocusOut(event, name) {
    if (open === name && !event.currentTarget.contains(event.relatedTarget)) open = null;
  }

  function onPointerDown(event) {
    if (open && !event.target.closest?.('[data-sheet]')) open = null;
  }

  function onKeyDown(event) {
    if (ui.editing || ui.help) return;
    if (event.key === 'F6') {
      event.preventDefault();
      if (toolbar.contains(document.activeElement)) actions.focusMap();
      else toolbar.querySelector('.item').focus();
      return;
    }
    if (open && event.key === 'Escape') open = null;
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    const name = Object.keys(SHORTCUTS).find((n) => SHORTCUTS[n].key === key && SHORTCUTS[n].shift === event.shiftKey);
    if (!name) return;
    event.preventDefault();
    open = null;
    actions[name]();
  }
</script>

<svelte:window onpointerdown={onPointerDown} onkeydown={onKeyDown} />

{#snippet sheet(name, icon, label)}
  <div class="group" data-sheet onfocusout={(event) => onSheetFocusOut(event, name)}>
    <button
      type="button"
      class="item"
      title={label}
      aria-label={label}
      aria-expanded={open === name}
      aria-controls="menu-{name}"
      onclick={(event) => toggle(name, event)}
    >
      <Icon name={icon} />
    </button>
    <div class="sheet" id="menu-{name}" class:shown={open === name}>
      {#each sheets[name] as item (item.label)}
        <button type="button" class="choice" disabled={item.disabled} onclick={() => choose(item)}>
          <Icon name={item.icon} />
          {item.label}
          {#if SHORTCUTS[item.action]}
            <kbd class="hint">{SHORTCUTS[item.action].label}</kbd>
          {/if}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

<nav class="menu" aria-label="Menu">
  <div class="actions" role="toolbar" aria-label="Map actions" tabindex="-1" bind:this={toolbar} onkeydown={onMenuKey}>
    {#if map.canUndo}
      <button type="button" class="item" title="Undo (⌘Z)" aria-label="Undo" onclick={actions.undo} transition:reveal>
        <Icon name="undo" />
      </button>
    {/if}
    {#if map.canRedo}
      <button type="button" class="item" title="Redo (⇧⌘Z)" aria-label="Redo" onclick={actions.redo} transition:reveal>
        <Icon name="redo" />
      </button>
    {/if}
    {@render sheet('map', 'eraser', 'Clear or reset')}
    {@render sheet('share', 'share', 'Share')}
    <button
      type="button"
      class="item"
      title="Help"
      aria-label="Help"
      aria-describedby="menu-tips"
      onclick={actions.openHelp}
      onmouseenter={() => (tips = true)}
      onmouseleave={() => (tips = false)}
      onfocus={() => (tips = true)}
      onblur={() => (tips = false)}
    >
      <Icon name="help" />
    </button>
    <button type="button" class="item mode" title="Switch mode" aria-label="Switch mode" onclick={flipTheme}>
      <Icon name="sun" class="mode-icon {theme.mode === 'light' ? 'shown' : ''}" />
      <Icon name="moon" class="mode-icon {theme.mode === 'dark' ? 'shown' : ''}" />
    </button>
  </div>

  <div class="tips" id="menu-tips" role="tooltip" class:shown={tips && !open}>
    <ul>
      <li>Double-click empty space to add an idea.</li>
      <li>Double-click an idea or a link to edit or colour it.</li>
      <li>Drag an idea onto another to link them. Drag it back the other way and the link goes both ways.</li>
      <li>Drag each premise onto the conclusion, then one premise onto the other, to make them argue together.</li>
      <li>Drag the background to move around. Scroll or pinch to zoom.</li>
      <li>Tab moves through the ideas. Enter edits, Delete removes, ⌘A selects everything, ⌘Z undoes.</li>
      <li>N adds an idea and L links the selected one. F6 jumps between the map and this menu.</li>
      <li><Icon name="eraser" /> clears the map or brings back the demo.</li>
      <li><Icon name="share" /> copies a link to this argument or saves it as PNG, SVG or PDF.</li>
      <li>Click <Icon name="help" /> for every shortcut.</li>
    </ul>
  </div>
</nav>

<style>
  .menu {
    position: fixed;
    bottom: calc(20px + var(--safe-bottom));
    left: 20px;
    z-index: 10;
    display: flex;
    align-items: center;
    padding: 4px 18px;
    background-color: var(--menu-bg);
    border-radius: 8px;
    box-shadow: var(--menu-shadow);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    transition: background-color 0.3s ease;
    animation: slide-enter 0.4s var(--ease-out) 0.15s both;
    user-select: none;
    -webkit-user-select: none;
  }

  .actions {
    display: flex;
  }

  .actions > :not(:last-child) {
    margin-right: 12px;
  }

  .item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-size: 16px;
    color: var(--site-btn-color);
    border-radius: 6px;
    transition:
      color 0.2s ease,
      opacity 0.2s ease;
  }

  .item:hover,
  .item:focus-visible {
    color: var(--primary-color);
  }

  .group {
    position: relative;
  }

  .sheet {
    position: absolute;
    bottom: calc(100% + 14px);
    left: -6px;
    z-index: 11;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 170px;
    padding: 6px;
    background-color: var(--menu-tip-bg);
    border: 1px solid rgb(255 255 255 / 10%);
    border-radius: 8px;
    box-shadow: 0 4px 15px rgb(0 0 0 / 20%);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    opacity: 0;
    visibility: hidden;
    transform: translateY(8px) scale(0.98);
    transform-origin: bottom left;
    transition:
      opacity 0.18s ease,
      transform 0.18s ease,
      visibility 0s linear 0.18s;
  }

  .sheet.shown {
    opacity: 1;
    visibility: visible;
    transform: none;
    transition:
      opacity var(--motion) var(--ease-out),
      transform var(--motion) var(--ease-out),
      visibility 0s linear 0s;
  }

  .choice {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    font-size: 14px;
    color: #ffffff;
    white-space: nowrap;
    text-align: left;
    border-radius: 6px;
    transition: background-color 0.2s ease;
  }

  .choice:hover:not(:disabled),
  .choice:focus-visible {
    background-color: rgb(255 255 255 / 12%);
  }

  .choice:disabled {
    opacity: 0.4;
  }

  .hint {
    min-width: 0;
    margin: 0 0 0 auto;
    padding: 0 0 0 16px;
    font: inherit;
    font-size: 12px;
    color: inherit;
    background: none;
    border: 0;
    box-shadow: none;
    opacity: 0.6;
  }

  .mode {
    display: grid;
    place-items: center;
  }

  .mode :global(.mode-icon) {
    grid-area: 1 / 1;
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

  .tips {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 0;
    z-index: 11;
    width: 320px;
    padding: 15px;
    font-size: 14px;
    line-height: 1.4;
    color: #ffffff;
    text-align: left;
    background-color: var(--menu-tip-bg);
    border: 1px solid rgb(255 255 255 / 10%);
    border-radius: 8px;
    box-shadow: 0 4px 15px rgb(0 0 0 / 20%);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(6px);
    transition:
      opacity 0.2s ease,
      transform 0.2s ease,
      visibility 0s linear 0.2s;
  }

  .tips.shown {
    opacity: 1;
    visibility: visible;
    transform: none;
    transition:
      opacity 0.3s var(--ease-out),
      transform 0.3s var(--ease-out),
      visibility 0s linear 0s;
  }

  .tips ul {
    margin: 0;
    padding-left: 20px;
  }

  .tips li {
    margin-bottom: 8px;
  }

  .tips li:last-child {
    margin-bottom: 0;
  }

  .tips :global(.icon) {
    margin: 0 0.1em;
    vertical-align: -0.15em;
  }

  @media (max-width: 600px) {
    .menu {
      left: 50%;
      transform: translateX(-50%);
    }

    .tips {
      width: 250px;
    }
  }

  @media (max-width: 380px) {
    .menu {
      padding: 4px 12px;
    }

    .actions > :not(:last-child) {
      margin-right: 6px;
    }

    .item {
      width: 32px;
      height: 32px;
    }
  }
</style>
