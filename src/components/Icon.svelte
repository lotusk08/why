<script>
  import { icons } from '../lib/icons.js';

  let { name, size = '1em', class: className = '' } = $props();
  const icon = $derived(icons[name]);
</script>

<svg class="icon {className}" viewBox={icon.viewBox} width={size} height={size} aria-hidden="true" focusable="false">
  <path d={icon.d} />
</svg>

<style>
  .icon {
    display: inline-block;
    flex: none;
    fill: currentcolor;
    vertical-align: -0.125em;
  }
</style>
