<script setup lang="ts">
import { Dock, DockIcon, DockSeparator } from "./components/Dock";
</script>

<template>
  <div select-none h-full flex overflow-hidden box-border flex-1>
    <div flex-1 rounded-lg flex flex-col justify-between p-4>
      <div flex-1 z-999 rounded-lg p-2 class="bg-[rgba(0,0,0,0.1)]">123</div>
      <div flex items-center justify-center>
        <Dock :magnification="30">
          <DockIcon>
            <div class="size-full i-unjs-ufo" />
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
          <DockIcon>
            <div class="size-full i-logos-adobe-xd" />
          </DockIcon>
          <DockIcon>
            <div class="size-full i-logos-adobe-lightroom" />
          </DockIcon>
        </Dock>
      </div>
    </div>
  </div>
</template>

<style></style>
