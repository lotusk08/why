<script>
  import Icon from './Icon.svelte';
  import { actions, map } from '../lib/map.svelte.js';

  const percent = $derived(`${Math.round(map.scale * 100)}%`);
</script>

<div class="zoom" role="group" aria-label="Zoom">
  <span class="level" aria-live="polite">{percent}</span>
  <button type="button" class="square" title="Zoom out (−)" aria-label="Zoom out" onclick={actions.zoomOut}>
    <Icon name="minus" />
  </button>
  <button type="button" class="square" title="Fit to view (0)" aria-label="Fit to view" onclick={actions.fit}>
    <Icon name="fit" />
  </button>
  <button type="button" class="square" title="Zoom in (+)" aria-label="Zoom in" onclick={actions.zoomIn}>
    <Icon name="plus" />
  </button>
</div>

<style>
  .zoom {
    position: absolute;
    right: 1.25rem;
    bottom: calc(1.25rem + var(--safe-bottom));
    display: flex;
    align-items: center;
    gap: 0.9rem;
    user-select: none;
    -webkit-user-select: none;
  }

  .level {
    min-width: 2.6rem;
    margin-right: 0.15rem;
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--text-muted-color);
  }

  .square {
    display: grid;
    place-items: center;
    width: 1.65rem;
    height: 1.65rem;
    color: var(--text-color);
    background-color: var(--main-bg);
    border-radius: 1px;
    box-shadow: var(--card-shadow);
    transform: rotate(45deg);
    transition:
      transform 0.2s ease-out,
      color 0.2s ease;
  }

  .square::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%) rotate(-45deg);
  }

  .square :global(.icon) {
    position: relative;
    font-size: 0.75rem;
    transform: rotate(-45deg);
  }

  .square:hover {
    color: var(--primary-color);
    transform: rotate(45deg) scale(1.1);
  }

  @media (max-width: 600px) {
    .zoom {
      right: 1rem;
      bottom: calc(5.25rem + var(--safe-bottom));
    }

    .level {
      display: none;
    }
  }
</style>
