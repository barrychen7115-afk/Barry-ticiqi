/**
 * SpeechRecognition 插件加载入口
 * 用 esbuild 打包后注入全局 window.SpeechRecognition
 */
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
window._SpeechRecognition = SpeechRecognition;
