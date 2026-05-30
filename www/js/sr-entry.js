/**
 * Speech Recognition Plugin Entry — esbuild IIFE bundle
 * Bundles @capacitor-community/speech-recognition into a single file
 * for vanilla JS / no-bundler projects.
 *
 * Build: npx esbuild sr-entry.js --bundle --format=iife --global-name=_TeleprompterSpeech --outfile=sr-bundle.js
 */
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

// Expose globally so vanilla JS app.js can use it
window._TeleprompterSpeech = { SpeechRecognition };
console.log('[PluginBundle] SpeechRecognition registered:', !!SpeechRecognition);
