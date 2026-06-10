import { registerRootComponent } from 'expo';

import App from './App';

// Silence debug logging in release builds (errors/warnings stay visible so
// crash reporters still capture them).
if (!__DEV__) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
