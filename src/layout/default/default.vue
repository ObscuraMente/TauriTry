<script setup lang="ts">
import FallingStarsBg from "./components/FallingStarsBg/index.vue";
import TitleBar from "./components/TitleBar/index.vue";
import { useColorMode } from "@vueuse/core";
import { computed } from "vue";
import { Dock, DockIcon, DockSeparator } from "./components/Dock";

// 在setup顶层调用useColorMode，而不是在computed内部
const colorMode = useColorMode();
const isDark = computed(() => colorMode.value == "dark");
</script>

<template>
  <div class="app-container">
    <TitleBar />

    <FallingStarsBg
      class="bg-white dark:bg-black"
      :color="isDark ? '#FFF' : '#555'"
    />

    <div select-none h-full flex overflow-hidden box-border flex-1>
      <div flex-1 rounded-lg flex flex-col justify-between p-2>
        <div flex-1 z-999 rounded-lg p-2 class="bg-[rgba(0,0,0,0.1)]">
          <router-view />
        </div>

        <div flex items-center justify-center>
          <Dock :magnification="30">
            <DockIcon>
              <div class="size-90% i-unjs-ufo" />
            </DockIcon>
            <DockSeparator />
            <DockIcon>
              <div class="size-90% i-logos-adobe-photoshop" />
            </DockIcon>
            <DockIcon>
              <div class="size-90% i-logos-adobe-premiere" />
            </DockIcon>
            <DockIcon>
              <div class="size-90% i-logos-adobe-illustrator" />
            </DockIcon>
            <DockIcon>
              <div class="size-90% i-logos-adobe-xd" />
            </DockIcon>
            <DockIcon>
              <div class="size-90% i-logos-adobe-lightroom" />
            </DockIcon>
          </Dock>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
</style>
