import * as SecureStore from 'expo-secure-store';
import { createJSONStorage } from 'zustand/middleware';

/** zustand persist storage backed by expo-secure-store (device preferences that survive launches). */
export const secureStorage = createJSONStorage(() => ({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
}));
