<script>
  import Icon from './Icon.svelte';
  import { actions, ui } from '../lib/map.svelte.js';

  let dialog = $state(null);
  let textarea = $state(null);
  let text = $state('');
  let lineType = $state('solid');
  let direction = $state('forward');
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
    actions.submitEdit(text, lineType, direction);
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

<dialog bind:this={dialog} aria-labelledby="editor-title" onclose={onClose} onpointerdown={onBackdrop}>
  <div class="panel">
    <header class="dialog-header">
      <h2 id="editor-title">{title}</h2>
      <button type="button" class="icon-button" aria-label="Close" onclick={actions.cancelEdit}>
        <Icon name="xmark" />
      </button>
    </header>

    <div class="dialog-body">
      <textarea
        bind:this={textarea}
        bind:value={text}
        rows="3"
        placeholder={isNode ? 'Say what you think…' : 'therefore'}
        aria-label={isNode ? 'Idea' : 'Link label'}
        onkeydown={onKeydown}></textarea>

      {#if isNode}
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
          <div class="kind" role="radiogroup" aria-label="Direction">
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
  textarea {
    display: block;
    width: 100%;
    min-height: 6rem;
    padding: 0.75rem;
    font-size: 1.05rem;
    line-height: 1.5;
    color: var(--heading-color);
    background: transparent;
    border: 1px solid var(--btn-border-color);
    border-radius: var(--radius-xs);
    resize: vertical;
    transition: border-color 0.15s ease-in-out;
  }

  textarea:focus {
    outline: none;
    border-color: var(--input-focus-border-color);
  }

  textarea::placeholder {
    color: var(--text-muted-color);
    opacity: 0.6;
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
    padding: 0.35rem 0.9rem;
    font-size: 0.9rem;
    color: var(--text-muted-color);
    transition:
      background-color 0.25s ease,
      color 0.25s ease;
  }

  .kind button + button {
    border-left: 1px solid var(--btn-border-color);
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
