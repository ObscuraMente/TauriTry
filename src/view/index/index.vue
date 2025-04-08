<script setup lang="ts">
import { Dock, DockIcon, DockSeparator } from "./components/Dock";
</script>

<template>
  <div select-none h-full flex overflow-hidden box-border flex-1>
    <div
      flex-1
      rounded-lg
      flex
      flex-col
      justify-between
      class="bg-[rgba(0,0,0,0.01)]"
      p-4
    >
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
