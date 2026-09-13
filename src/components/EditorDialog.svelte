<script>
  import Icon from './Icon.svelte';
  import { actions, ui } from '../lib/map.svelte.js';

  let dialog = $state(null);
  let textarea = $state(null);
  let text = $state('');
  let lineType = $state('solid');
  let direction = $state('forward');

  const editing = $derived(ui.editing);
  const isNode = $derived(editing?.kind === 'node');
  const directional = $derived(Boolean(editing) && !isNode && !editing.joint);
  const title = $derived(
    !editing ? '' : !isNode ? 'Link' : editing.isNew ? 'New idea' : lineType === 'dashed' ? 'Objection' : 'Premise'
  );

  $effect(() => {
    if (!dialog) return;
    if (editing) {
      text = editing.text;
      lineType = editing.lineType;
      direction = editing.twoWay ? 'both' : 'forward';
      if (!dialog.open) dialog.showModal();
      const end = editing.text.length;
      queueMicrotask(() => {
        textarea?.focus();
        textarea?.setSelectionRange(end, end);
      });
    } else if (dialog.open) {
      dialog.close();
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
        Delete
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

  .note {
    margin: 0.75rem 0 0;
    font-size: 0.85rem;
    color: var(--text-muted-color);
  }
</style>
