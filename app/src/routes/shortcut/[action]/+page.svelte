<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { STORAGE_KEYS } from '#lib/constants.js';
  import { storageService } from '#lib/services/storage.js';
  import { prefs } from '#lib/utils/prefs.js';

  // The app icon's shortcuts (see static/manifest.json): "add" or "scan" an
  // expense in the group opened last on this device, still saved here.
  // Without one, the groups.
  onMount(async () => {
      const id = prefs.get(STORAGE_KEYS.LAST_GROUP);
      const saved = id ? (await storageService.getRecentKimpayIds()).includes(id) : false;
      if (!id || !saved) {
          await goto('/', { replace: true });
          return;
      }
      const scan = page.params.action === 'scan';
      await goto(`/k/${id}/add${scan ? '?scan' : ''}`, { replace: true });
  });
</script>
