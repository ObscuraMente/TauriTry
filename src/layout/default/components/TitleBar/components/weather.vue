<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";

interface Weather {
  province: string;
  city: string;
  weather: string;
  temperature: string;
}

const weather = ref<Weather>();
async function getWeather() {
  // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
  const res = await invoke("get_weather");
  console.log(res);
  weather.value = res as Weather;
}

onMounted(async () => {
  await getWeather();
});
</script>

<template>
  <div class="text-12px ml-3">
    {{ weather?.province }} {{ weather?.city }} {{ weather?.weather }}
    {{ weather?.temperature }}℃
  </div>
</template>
