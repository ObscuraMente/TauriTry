<script setup lang="ts">
import FallingStarsBg from "./components/FallingStarsBg/index.vue";
import TitleBar from "./components/TitleBar/index.vue";
import { useColorMode } from "@vueuse/core";

const isDark = computed(() => useColorMode().value == "dark");
</script>

<template>
  <div class="app-container">
    <TitleBar />
    <FallingStarsBg
      class="bg-white dark:bg-black"
      :color="isDark ? '#FFF' : '#555'"
    />
    <router-view />
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
}
</style>
