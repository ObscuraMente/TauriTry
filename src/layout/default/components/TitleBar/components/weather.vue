<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";

// 确保生命周期钩子在其他逻辑之前定义
const weather = ref<Weather>();

// 先注册生命周期钩子
onMounted(() => {
  getWeather();
});

interface Weather {
  province: string;
  city: string;
  weather: string;
  temperature: string;
}

async function getWeather() {
  const res = await invoke("get_weather");
  weather.value = res as Weather;
}
</script>

<template>
  <div class="text-12px ml-3">
    {{ weather?.province }} {{ weather?.city }} {{ weather?.weather }}
    {{ weather?.temperature }}℃
  </div>
</template>
