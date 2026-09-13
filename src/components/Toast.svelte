<script>
  import { ui } from '../lib/map.svelte.js';
</script>

<div class="toast" role="status" aria-live="polite" class:shown={ui.toast}>
  {ui.toast}
</div>

<style>
  .toast {
    position: fixed;
    bottom: calc(4.5rem + var(--safe-bottom));
    left: 50%;
    z-index: 20;
    padding: 0.35rem 0.65rem;
    font-size: 0.75rem;
    line-height: 1.3;
    color: #ffffff;
    background: var(--tooltip-bg);
    border-radius: var(--radius-xs);
    opacity: 0;
    visibility: hidden;
    transform: translate(-50%, 6px);
    transition:
      opacity 0.2s ease,
      transform 0.2s ease,
      visibility 0s linear 0.2s;
    pointer-events: none;
  }

  .toast.shown {
    opacity: 1;
    visibility: visible;
    transform: translate(-50%, 0);
    transition:
      opacity 0.2s ease,
      transform 0.2s ease,
      visibility 0s linear 0s;
  }
</style>
