<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { profileMenu } from '#lib/stores/profileMenu.svelte.js';

    // The account (name, email, photo) now lives in the profile sheet: older
    // links land there.
    onMount(async () => {
        await goto('/', { replaceState: true });
        profileMenu.open();
    });
</script>
