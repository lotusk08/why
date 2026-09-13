<script>
  import { onMount } from 'svelte';
  import { actions, initialMap, mountMap } from '../lib/map.svelte.js';
  import { theme } from '../lib/theme.svelte.js';

  let container = $state(null);

  onMount(() => {
    let cleanup = null;
    let cancelled = false;
    initialMap().then((elements) => {
      if (!cancelled) cleanup = mountMap(container, elements);
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  });

  $effect(() => {
    void theme.mode;
    actions.refreshTheme();
  });
</script>

<div class="map" bind:this={container}></div>

<style>
  .map {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .map :global(canvas) {
    display: block;
    outline: none;
  }
</style>
