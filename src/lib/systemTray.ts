import { TrayIcon, TrayIconEvent } from "@tauri-apps/api/tray";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { Window } from "@tauri-apps/api/window";
import pkg from "../../package.json";
import { Menu } from "@tauri-apps/api/menu";

function capitalizeFirstLetter(str: string) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// 处理窗口操作的工具函数
async function getMainWindow() {
  return new Window("main");
}

async function showAndFocusWindow() {
  const appWindow = await getMainWindow();
  return appWindow
    .show()
    .then(() => appWindow.unminimize())
    .then(() => appWindow.setFocus());
}

export default async function tray_init() {
  // 判断是否为开发环境
  const isDev = process.env.NODE_ENV === "development";

  const menu = await Menu.new({
    items: [
      {
        id: "info",
        text: "关于",
        action: () => {
          console.log("info press");
        },
      },
      {
        id: "quit",
        text: "退出",
        action: () => {
          // 退出逻辑
          getMainWindow()
            .then((window) => window.close())
            .catch((err) => console.error("关闭应用时出错:", err));
        },
      },
    ],
  });

  // 获取应用图标，如果失败则使用默认图标
  let icon;
  try {
    icon = await defaultWindowIcon();
  } catch (error) {
    console.warn("无法加载默认图标:", error);
    icon = ""; // 使用空字符串作为后备
  }

  const options = {
    icon: icon || "",
    // 菜单将由Rust端自动处理
    tooltip: capitalizeFirstLetter(pkg.name), // 添加托盘提示文本
    menu,
    // 托盘行为
    action: (event: TrayIconEvent) => {
      switch (event.type) {
        case "Click":
          if (event.button === "Left") {
            // 左键点击显示/隐藏窗口
            getMainWindow()
              .then((appWindow) =>
                appWindow
                  .isVisible()
                  .then((visible) =>
                    Promise.all([visible, appWindow.isMinimized()])
                  )
                  .then(([visible, minimized]) => {
                    if (visible && !minimized) {
                      // 窗口可见且未最小化时，只设置焦点
                      return appWindow.setFocus();
                    } else {
                      // 窗口不可见或已最小化，则显示并取消最小化
                      return showAndFocusWindow();
                    }
                  })
              )
              .catch((err) => console.error("处理左键点击时出错:", err));
          }
          break;
        case "DoubleClick":
          // 双击显示窗口
          showAndFocusWindow().catch((err) =>
            console.error("处理双击时出错:", err)
          );
          break;
        case "Enter":
          if (isDev) {
            console.log(
              `鼠标悬停在托盘: ${event.rect?.position.x}, ${event.rect?.position.y}`
            );
          }
          break;
        case "Move":
          if (isDev) {
            console.log(
              `鼠标在托盘上移动: ${event.rect?.position.x}, ${event.rect?.position.y}`
            );
          }
          break;
        case "Leave":
          if (isDev) {
            console.log(
              `鼠标离开托盘: ${event.rect?.position.x}, ${event.rect?.position.y}`
            );
          }
          break;
      }
    },
  };

  try {
    const tray = await TrayIcon.new(options);
    console.log("系统托盘初始化成功");
    return tray;
  } catch (error) {
    console.error("系统托盘初始化失败:", error);
    throw error;
  }
}
