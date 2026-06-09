// Expo Go fallback for `react-native-keyboard-controller`.
//
// That package ships a native module (KeyboardControllerNative) which does NOT
// exist in Expo Go (SDK 53+), so importing it — e.g. via react-native-gifted-chat
// — crashes the app at boot with "KeyboardControllerNative.getConstants is not a
// function". This shim provides JS-only no-op equivalents so the app runs in
// Expo Go for quick testing. It is ONLY used when metro is started with
// KBC_SHIM=1 (see metro.config.js); a real development/production build uses the
// actual native module and full keyboard behavior.
import React from 'react';
import { View, KeyboardAvoidingView as RNKeyboardAvoidingView } from 'react-native';

export const KeyboardProvider = ({ children }) => React.createElement(React.Fragment, null, children);
export const KeyboardAvoidingView = (props) => React.createElement(RNKeyboardAvoidingView, props, props.children);
export const OverKeyboardView = ({ children }) => React.createElement(View, null, children);
export const KeyboardStickyView = ({ children, ...p }) => React.createElement(View, p, children);
export const KeyboardAwareScrollView = ({ children, ...p }) => React.createElement(View, p, children);

const noop = () => {};
export const useKeyboardHandler = noop;
export const useKeyboardContext = () => ({ enabled: false });
export const useReanimatedKeyboardAnimation = () => ({ height: { value: 0 }, progress: { value: 0 } });
export const useKeyboardAnimation = () => ({ height: { value: 0 }, progress: { value: 0 } });

export const KeyboardController = { setInputMode: noop, setDefaultMode: noop, dismiss: noop, setFocusTo: noop };
export const KeyboardEvents = { addListener: () => ({ remove: noop }) };
export const AndroidSoftInputModes = { SOFT_INPUT_ADJUST_RESIZE: 16, SOFT_INPUT_ADJUST_PAN: 32 };

export default {
  KeyboardProvider, KeyboardController, KeyboardEvents, KeyboardAvoidingView,
  OverKeyboardView, KeyboardStickyView, KeyboardAwareScrollView, AndroidSoftInputModes,
};
