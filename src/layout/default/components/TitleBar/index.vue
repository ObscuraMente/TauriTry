<script setup>
import { ref, watch } from "vue";

import { Window } from "@tauri-apps/api/window";

const appWindow = new Window("main");
const max_state_name = ref("window-maximize");
const max_state = ref(false);

watch(max_state, async (newValue) => {
  if (newValue) {
    //当前状态是最大化
    max_state_name.value = "window-restore";
    await appWindow.maximize();
  } else {
    max_state_name.value = "window-maximize";
    await appWindow.unmaximize();
  }
});

async function window_minimize() {
  await appWindow.minimize();
}

function window_maximize() {
  max_state.value = !max_state.value;
}

async function window_close() {
  await appWindow.close();
}
</script>

<template>
  <div
    class="title-bar flex items-center justify-between h-35px bg-black/3 dark:bg-white/3 relative z-999"
    data-tauri-drag-region
  >
    <div class="flex-1 h-full flex items-center pl-10px">
      <div class="text-12px text-text select-none">Tauri App</div>
    </div>
    <div class="flex" style="-webkit-app-region: no-drag">
      <button
        class="w-35px h-35px flex items-center justify-center bg-transparent border-none text-text cursor-pointer transition-colors hover:bg-black/10 dark:hover:bg-white/10"
        @click="window_minimize"
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        class="w-35px h-35px flex items-center justify-center bg-transparent border-none text-text cursor-pointer transition-colors hover:bg-black/10 dark:hover:bg-white/10"
        @click="window_maximize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect width="10" height="10" fill="none" stroke="currentColor" />
        </svg>
      </button>
      <button
        class="w-35px h-35px flex items-center justify-center bg-transparent border-none text-text cursor-pointer transition-colors hover:bg-red-600 hover:text-white"
        @click="window_close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style>
.title-bar {
  -webkit-app-region: drag;
}
</style>
