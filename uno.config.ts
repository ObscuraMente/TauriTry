import {
  defineConfig,
  presetIcons,
  presetAttributify,
  presetTypography,
  transformerVariantGroup,
  transformerDirectives,
  transformerAttributifyJsx,
  presetUno,
} from "unocss";
import presetTagify from "@unocss/preset-tagify";
import presetRemToPx from "@unocss/preset-rem-to-px";

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons(),
    presetAttributify(),
    presetTypography(),
    presetTagify(),
    presetRemToPx(),
  ],
  transformers: [
    transformerVariantGroup(),
    transformerDirectives(),
    transformerAttributifyJsx(),
  ],
});
