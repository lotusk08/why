<script>
  import Icon from './Icon.svelte';
  import { actions, map } from '../lib/map.svelte.js';

  let tips = $state(false);
</script>

<nav class="menu" aria-label="Menu">
  <div class="actions" role="toolbar" aria-label="Map actions">
    <button
      type="button"
      class="item"
      title="Undo (⌘Z)"
      aria-label="Undo"
      disabled={!map.canUndo}
      onclick={actions.undo}
    >
      <Icon name="undo" />
    </button>
    <button
      type="button"
      class="item"
      title="Redo (⇧⌘Z)"
      aria-label="Redo"
      disabled={!map.canRedo}
      onclick={actions.redo}
    >
      <Icon name="redo" />
    </button>
    <button type="button" class="item" title="Save as image" aria-label="Save as image" onclick={actions.saveImage}>
      <Icon name="download" />
    </button>
    <button type="button" class="item" title="Copy link" aria-label="Copy link" onclick={actions.share}>
      <Icon name="link" />
    </button>
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
  </div>

  <div class="tips" id="menu-tips" role="tooltip" class:shown={tips}>
    <ul>
      <li>Double-click empty space to add an idea.</li>
      <li>Double-click an idea or a link to edit it.</li>
      <li>Drag an idea onto another to link them.</li>
      <li>Drag each premise onto the conclusion, then one premise onto the other, to make them argue together.</li>
      <li>Drag the background to move around. Scroll or pinch to zoom.</li>
      <li>Tab moves through the ideas. Enter edits, Delete removes, ⌘Z undoes.</li>
      <li><Icon name="download" /> saves an image. <Icon name="link" /> copies a link to this argument.</li>
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
    user-select: none;
    -webkit-user-select: none;
  }

  .actions {
    display: flex;
    gap: 12px;
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

  .item:disabled {
    opacity: 0.35;
  }

  .item:disabled:hover {
    color: var(--site-btn-color);
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
    transition:
      opacity 0.3s ease,
      visibility 0s linear 0.3s;
  }

  .tips.shown {
    opacity: 1;
    visibility: visible;
    transition:
      opacity 0.3s ease,
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
</style>
