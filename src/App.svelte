<script>
  import TopBar from './components/TopBar.svelte';
  import Canvas from './components/Canvas.svelte';
  import ZoomControl from './components/ZoomControl.svelte';
  import EmptyHint from './components/EmptyHint.svelte';
  import EditorDialog from './components/EditorDialog.svelte';
  import HelpDialog from './components/HelpDialog.svelte';
  import Toast from './components/Toast.svelte';
  import { map } from './lib/map.svelte.js';
</script>

<TopBar />

<main class="workspace" aria-label="Argument map" data-nodes={map.nodes} data-edges={map.edges}>
  <Canvas />
  {#if map.ready && map.nodes === 0}
    <EmptyHint />
  {/if}
  <ZoomControl />
</main>

<EditorDialog />
<HelpDialog />
<Toast />

<style>
  .workspace {
    position: fixed;
    top: calc(var(--topbar-height) + var(--safe-top));
    right: 0;
    bottom: 0;
    left: 0;
  }
</style>
