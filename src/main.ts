import { createApp } from "vue";
import App from "./App.vue";
import "virtual:uno.css";
import router from "./router";
import systemTray from "./lib/systemTray";

systemTray();
createApp(App).use(router).mount("#app");
