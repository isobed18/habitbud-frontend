// Learn more: https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo Go quick-test mode: start with `KBC_SHIM=1 npx expo start` to swap the
// native `react-native-keyboard-controller` (pulled in by gifted-chat) for a
// JS-only shim so the app boots in Expo Go. Real dev/prod builds omit this and
// use the actual native module. See shims/keyboard-controller.js.
if (process.env.KBC_SHIM === '1') {
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'react-native-keyboard-controller') {
      return { type: 'sourceFile', filePath: path.resolve(__dirname, 'shims/keyboard-controller.js') };
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
