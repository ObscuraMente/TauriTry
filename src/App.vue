<script setup lang="ts">
// import { invoke } from "@tauri-apps/api/core";
// async function greet() {
//   // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//   greetMsg.value = await invoke("greet", { name: name.value });
// }
</script>

<template>
  <router-view />
</template>

<style>
html,
body {
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  overflow: hidden;
}

#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
