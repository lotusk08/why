<script>
  import Icon from './Icon.svelte';
  import { actions, ui } from '../lib/map.svelte.js';
  import { NODE_COLORS } from '../lib/reasons/element.js';

  let dialog = $state(null);
  let textarea = $state(null);
  let text = $state('');
  let lineType = $state('solid');
  let direction = $state('forward');
  let color = $state('');
  let openedId = null;

  const editing = $derived(ui.editing);
  const isNode = $derived(editing?.kind === 'node');
  const directional = $derived(Boolean(editing) && !isNode && !editing.joint);
  const title = $derived(
    !editing
      ? ''
      : !isNode
        ? editing.joint
          ? 'Joint link'
          : 'Link'
        : editing.isNew
          ? 'New idea'
          : lineType === 'dashed'
            ? 'Objection'
            : 'Premise'
  );
  const deleteLabel = $derived(
    !editing || isNode ? 'Delete' : editing.joint ? 'Delete all' : editing.merged ? 'Delete both ways' : 'Delete'
  );

  $effect(() => {
    if (!dialog) return;
    if (editing) {
      if (openedId === editing.id) return;
      openedId = editing.id;
      text = editing.text;
      lineType = editing.lineType;
      color = editing.color ?? '';
      direction = editing.twoWay ? 'both' : 'forward';
      if (!dialog.open) dialog.showModal();
      const end = editing.text.length;
      queueMicrotask(() => {
        textarea?.focus();
        textarea?.setSelectionRange(end, end);
      });
    } else {
      openedId = null;
      if (dialog.open) dialog.close();
    }
  });

  function short(value) {
    const name = String(value || '').trim() || '…';
    return name.length > 18 ? `${name.slice(0, 17)}…` : name;
  }

  function submit() {
    actions.submitEdit(text, lineType, direction, color);
  }

  function onKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function onClose() {
    if (ui.editing) actions.cancelEdit();
  }

  function onBackdrop(event) {
    if (event.target === dialog) submit();
  }
</script>

<dialog class="editor" bind:this={dialog} aria-labelledby="editor-title" onclose={onClose} onpointerdown={onBackdrop}>
  <div class="panel">
    <header class="dialog-header">
      <h2 id="editor-title">{title}</h2>
      <button type="button" class="icon-button" aria-label="Close" onclick={actions.cancelEdit}>
        <Icon name="xmark" />
      </button>
    </header>

    <div class="dialog-body">
      <textarea
        class="field"
        class:idea={isNode}
        class:objection={isNode && lineType === 'dashed'}
        style:--tint={isNode && color ? `var(--node-${color})` : null}
        bind:this={textarea}
        bind:value={text}
        rows="2"
        placeholder={isNode ? 'Say what you think…' : 'therefore'}
        aria-label={isNode ? 'Idea' : 'Link label'}
        onkeydown={onKeydown}></textarea>

      {#if isNode}
        <div class="options">
          <div class="kind" role="radiogroup" aria-label="Kind of idea">
            <button
              type="button"
              role="radio"
              aria-checked={lineType === 'solid'}
              class:active={lineType === 'solid'}
              onclick={() => (lineType = 'solid')}
            >
              Premise
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={lineType === 'dashed'}
              class="objection"
              class:active={lineType === 'dashed'}
              onclick={() => (lineType = 'dashed')}
            >
              Objection
            </button>
          </div>
          <div class="swatches" role="radiogroup" aria-label="Colour">
            {#each ['', ...NODE_COLORS] as name (name)}
              <button
                type="button"
                role="radio"
                class="swatch"
                style:--swatch={name ? `var(--node-${name})` : null}
                aria-checked={color === name}
                aria-label={name ? name[0].toUpperCase() + name.slice(1) : 'No colour'}
                title={name ? name[0].toUpperCase() + name.slice(1) : 'No colour'}
                class:active={color === name}
                class:none={!name}
                onclick={() => (color = name)}
              ></button>
            {/each}
          </div>
        </div>
      {:else}
        {#if editing?.joint}
          <ul class="parts" aria-label="Premises in this link">
            {#each editing.parts as part (part.id)}
              <li class="chip">
                <span>{short(part.text)} → {short(editing.to)}</span>
                <button type="button" aria-label="Remove {short(part.text)}" onclick={() => actions.detach(part.id)}>
                  <Icon name="xmark" />
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        {#if directional}
          <div class="kind stack" role="radiogroup" aria-label="Direction">
            <button
              type="button"
              role="radio"
              aria-checked={direction === 'forward'}
              class:active={direction === 'forward'}
              onclick={() => (direction = 'forward')}
            >
              {short(editing.from)} → {short(editing.to)}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={direction === 'backward'}
              class:active={direction === 'backward'}
              onclick={() => (direction = 'backward')}
            >
              {short(editing.to)} → {short(editing.from)}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={direction === 'both'}
              class:active={direction === 'both'}
              onclick={() => (direction = 'both')}
            >
              Both ways
            </button>
          </div>
        {/if}
        <p class="note">Leave the label empty to name it automatically.</p>
      {/if}
    </div>

    <footer class="dialog-footer">
      <button type="button" class="btn danger" onclick={actions.deleteEditing}>
        <Icon name="trash" />
        {deleteLabel}
      </button>
      <button type="button" class="btn primary" onclick={submit}>
        <Icon name="check" />
        Done
      </button>
    </footer>
  </div>
</dialog>

<style>
  .editor {
    width: min(28rem, calc(100vw - 2rem));
  }

  .editor .dialog-header {
    padding-top: 0.75rem;
    border-bottom: 0;
  }

  .editor .dialog-body {
    padding-top: 0.25rem;
  }

  .field {
    display: block;
    width: 100%;
    min-height: 3.5rem;
    max-height: 40vh;
    padding: 0.85rem 1rem;
    field-sizing: content;
    font-size: 1rem;
    line-height: 1.45;
    text-align: center;
    color: var(--canvas-node-text);
    background: var(--canvas-node-bg);
    border: 1px solid var(--canvas-node-border);
    border-radius: 6px;
    resize: none;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .field.idea {
    background: color-mix(in srgb, var(--tint, var(--canvas-node-bg)) 14%, var(--canvas-node-bg));
    border-color: var(--tint, var(--canvas-node-border));
  }

  .field.objection {
    border-style: dashed;
    border-color: var(--canvas-objection);
  }

  .field:not(.idea) {
    min-height: 2.75rem;
    padding: 0.6rem 1rem;
    font-family: var(--font-serif);
    font-style: italic;
    background: transparent;
  }

  .field:focus {
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 22%, transparent);
  }

  .field::placeholder {
    color: var(--text-muted-color);
    opacity: 0.6;
  }

  .options {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .options .kind {
    margin-top: 0;
  }

  .editor .btn.danger {
    color: var(--text-muted-color);
  }

  .editor .btn.danger:hover,
  .editor .btn.danger:focus-visible {
    color: var(--danger-color);
  }

  .kind {
    display: inline-flex;
    flex-wrap: wrap;
    max-width: 100%;
    margin-top: 1rem;
    border: 1px solid var(--btn-border-color);
    border-radius: var(--radius-xs);
    overflow: hidden;
  }

  .kind button {
    padding: 0.3rem 0.8rem;
    font-size: 0.85rem;
    color: var(--text-muted-color);
    transition:
      background-color 0.25s ease,
      color 0.25s ease;
  }

  .kind button + button {
    border-left: 1px solid var(--btn-border-color);
  }

  .kind.stack {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .kind.stack button {
    text-align: left;
  }

  .kind.stack button + button {
    border-top: 1px solid var(--btn-border-color);
    border-left: 0;
  }

  .kind button:hover {
    color: var(--primary-color);
  }

  .kind button.active {
    color: var(--primary-color);
    background-color: var(--site-hover-bg);
  }

  .kind button.objection.active {
    color: var(--danger-color);
    background-color: color-mix(in srgb, var(--danger-color) 10%, transparent);
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .swatch {
    width: 1.25rem;
    height: 1.25rem;
    background: color-mix(in srgb, var(--swatch, transparent) 14%, var(--canvas-node-bg));
    border: 1.5px solid var(--swatch, var(--canvas-node-border));
    border-radius: 50%;
    transition:
      box-shadow 0.2s ease,
      transform 0.2s ease;
  }

  .swatch.none {
    background: linear-gradient(
      135deg,
      transparent calc(50% - 1px),
      var(--canvas-node-border) calc(50% - 1px),
      var(--canvas-node-border) calc(50% + 1px),
      transparent calc(50% + 1px)
    );
  }

  .swatch:hover {
    transform: scale(1.15);
  }

  .swatch.active {
    box-shadow:
      0 0 0 2px var(--main-bg),
      0 0 0 4px var(--primary-color);
  }

  .parts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 1rem 0 0;
    padding: 0;
    list-style: none;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.35rem 0.3rem 0.75rem;
    font-size: 0.9rem;
    color: var(--text-color);
    border: 1px solid var(--btn-border-color);
    border-radius: var(--radius-xs);
  }

  .chip button {
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.8rem;
    color: var(--site-btn-color);
    border-radius: 50%;
    transition:
      background-color 0.25s ease,
      color 0.25s ease;
  }

  .chip button:hover,
  .chip button:focus-visible {
    color: var(--danger-color);
    background-color: color-mix(in srgb, var(--danger-color) 10%, transparent);
  }

  .note {
    margin: 0.75rem 0 0;
    font-size: 0.85rem;
    color: var(--text-muted-color);
  }
</style>
