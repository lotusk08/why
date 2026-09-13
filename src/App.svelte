<script>
  import Menu from './components/Menu.svelte';
  import Canvas from './components/Canvas.svelte';
  import EditorDialog from './components/EditorDialog.svelte';
  import HelpDialog from './components/HelpDialog.svelte';
  import Toast from './components/Toast.svelte';
  import { map } from './lib/map.svelte.js';
</script>

<main
  class="workspace"
  aria-label="Argument map"
  data-nodes={map.nodes}
  data-edges={map.edges}
  data-scale={map.scale.toFixed(3)}
>
  <Canvas />
</main>

<Menu />
<EditorDialog />
<HelpDialog />
<Toast />

<style>
  .workspace {
    position: fixed;
    inset: 0;
  }
</style>
