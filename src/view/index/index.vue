<script setup lang="ts">
import FallingStarsBg from "./components/FallingStarsBg/index.vue";
import { useColorMode } from "@vueuse/core";
import { Dock, DockIcon, DockSeparator } from "./components/Dock";

const isDark = computed(() => useColorMode().value == "dark");
</script>

<template>
  <FallingStarsBg
    class="bg-white dark:bg-black"
    :color="isDark ? '#FFF' : '#555'"
  />

  <div select-none h-full p-4 flex overflow-hidden box-border>
    <div flex-1 backdrop-blur-3 rounded-lg flex flex-col justify-between>
      <div>123</div>
      <div flex items-center justify-center>
        <Dock mb-5 :magnification="30">
          <DockIcon>
            <div class="size-full i-logos-adobe-after-effects" />
          </DockIcon>
          <DockSeparator />
          <DockIcon>
            <div class="size-full i-logos-adobe-photoshop" />
          </DockIcon>
          <DockIcon>
            <div class="size-full i-logos-adobe-premiere" />
          </DockIcon>
          <DockIcon>
            <div class="size-full i-logos-adobe-illustrator" />
          </DockIcon>
        </Dock>
      </div>
    </div>
  </div>
</template>

<style></style>
