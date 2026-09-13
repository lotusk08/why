<script>
  import Icon from './Icon.svelte';
  import { actions, ui } from '../lib/map.svelte.js';

  let dialog = $state(null);

  $effect(() => {
    if (!dialog) return;
    if (ui.help && !dialog.open) dialog.showModal();
    else if (!ui.help && dialog.open) dialog.close();
  });

  function onClose() {
    if (ui.help) actions.closeHelp();
  }

  function onBackdrop(event) {
    if (event.target === dialog) actions.closeHelp();
  }
</script>

<dialog bind:this={dialog} aria-labelledby="help-title" onclose={onClose} onpointerdown={onBackdrop}>
  <div class="panel">
    <header class="dialog-header">
      <h2 id="help-title">How to think</h2>
      <button type="button" class="icon-button" aria-label="Close" onclick={actions.closeHelp}>
        <Icon name="xmark" />
      </button>
    </header>

    <div class="dialog-body">
      <p class="lead">
        <em>Premises support a conclusion. Objections push back.</em>
      </p>

      <h3>Mouse &amp; touch</h3>
      <ul>
        <li><strong>Double-click</strong> empty space to add an idea.</li>
        <li><strong>Double-click</strong> an idea or a link to edit it.</li>
        <li><strong>Drag</strong> an idea onto another to link them.</li>
        <li>Drag each premise onto the conclusion, then one premise onto the other, to make them argue together.</li>
        <li><strong>Drag</strong> the background to pan. <strong>Scroll</strong> or <strong>pinch</strong> to zoom.</li>
      </ul>

      <h3>Keyboard</h3>
      <dl class="keys">
        <dt><kbd>Tab</kbd> <kbd>⇧ Tab</kbd></dt>
        <dd>Move through the ideas</dd>
        <dt><kbd>Enter</kbd></dt>
        <dd>Edit the selected idea</dd>
        <dt><kbd>⌫</kbd></dt>
        <dd>Delete the selected idea</dd>
        <dt><kbd>⌘ Z</kbd> <kbd>⇧ ⌘ Z</kbd></dt>
        <dd>Undo and redo</dd>
        <dt><kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd></dt>
        <dd>Nudge the selected idea</dd>
        <dt><kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd></dt>
        <dd>Zoom in, out, fit</dd>
        <dt><kbd>Esc</kbd></dt>
        <dd>Deselect</dd>
      </dl>

      <p class="note">
        The map is saved in this browser as you go. <strong>Copy link</strong> puts the whole map in the address, so anyone
        with the link opens the same argument.
      </p>
      <p class="credits">
        Built on Reasons.js by Dave Kinkead.
        <a href="https://stevehoang.com" rel="noopener">Made by Steve</a>.
      </p>
    </div>
  </div>
</dialog>

<style>
  .lead {
    margin-bottom: 1.25rem;
    color: var(--heading-color);
  }

  h3 {
    margin: 1.25rem 0 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted-color);
  }

  ul {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.95rem;
  }

  li {
    margin: 0.25rem 0;
  }

  ::marker {
    color: var(--text-muted-color);
  }

  .keys {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 1rem;
    row-gap: 0.4rem;
    align-items: center;
    margin: 0;
    font-size: 0.95rem;
  }

  .keys dt {
    white-space: nowrap;
  }

  .keys dd {
    margin: 0;
  }

  .note {
    margin: 1.5rem 0 0;
    padding-top: 1rem;
    font-size: 0.9rem;
    border-top: 1px solid var(--main-border-color);
  }

  .credits {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--text-muted-color);
  }

  .credits a {
    color: var(--secondary-color);
  }

  .credits a:hover {
    color: var(--primary-color);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
  }

  @media (max-width: 480px) {
    .keys {
      grid-template-columns: 1fr;
      row-gap: 0.15rem;
    }

    .keys dd {
      margin-bottom: 0.5rem;
    }
  }
</style>
