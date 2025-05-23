<template>
  <div
    ref="dockRef"
    :class="
      cn(
        'backdrop-blur-1 bg-transparent dark:bg-black/10  mx-auto mt-3 flex h-[25px] w-max rounded-2xl border border-[#ddddde] border-1px border-solid p-3 transition-all gap-3',
        orientation === 'vertical' && 'flex-col w-[58px] h-max',
        props.class,
        dockClass
      )
    "
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide, type HTMLAttributes } from "vue";
import { cn } from "../../../../lib/utils";
import type { DataOrientation, Direction } from "./types";
import {
  MOUSE_X_INJECTION_KEY,
  MOUSE_Y_INJECTION_KEY,
  MAGNIFICATION_INJECTION_KEY,
  DISTANCE_INJECTION_KEY,
  ORIENTATION_INJECTION_KEY,
} from "./injectionKeys";

interface DockProps {
  class?: HTMLAttributes["class"];
  magnification?: number;
  distance?: number;
  direction?: Direction;
  orientation?: DataOrientation;
}

const props = withDefaults(defineProps<DockProps>(), {
  magnification: 60,
  distance: 140,
  direction: "middle",
  orientation: "horizontal",
});

const dockRef = ref<HTMLElement | null>(null);
const mouseX = ref(Infinity);
const mouseY = ref(Infinity);
const magnification = computed(() => props.magnification);
const distance = computed(() => props.distance);

// const dockClass = computed(() => ({
//   "items-start": props.direction === "top",
//   "items-center": props.direction === "middle",
//   "items-end": props.direction === "bottom",
// }));

const dockClass = computed(() => {
  if (props.direction === "top") return "items-start";
  if (props.direction === "bottom") return "items-end";
  return "items-center";
});

function onMouseMove(e: MouseEvent) {
  requestAnimationFrame(() => {
    mouseX.value = e.pageX;
    mouseY.value = e.pageY;
  });
}

function onMouseLeave() {
  requestAnimationFrame(() => {
    mouseX.value = Infinity;
    mouseY.value = Infinity;
  });
}

provide(MOUSE_X_INJECTION_KEY, mouseX);
provide(MOUSE_Y_INJECTION_KEY, mouseY);
provide(ORIENTATION_INJECTION_KEY, props.orientation);
provide(MAGNIFICATION_INJECTION_KEY, magnification);
provide(DISTANCE_INJECTION_KEY, distance);
</script>
