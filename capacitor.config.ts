import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.teleprompter.pro',
  appName: '逆象提词',
  webDir: 'www',

  // iOS 专属配置
  ios: {
    contentInset: 'always',
    // 隐藏状态栏，让相机预览全屏
    allowsLinkPreview: false,
    scrollEnabled: false,
    // 防止 iOS 键盘弹出时页面滚动
    keyboardResize: true,
  },

  // 插件配置
  plugins: {
    StatusBar: {
      style: 'dark',
      overlaysWebView: false,
    },
    Camera: {
      promptLabelHeader: '使用相机',
      promptLabelPhoto: '拍摄',
    },
  },

  server: {
    // 本地开发时使用
    cleartext: true,
  },
};

export default config;
