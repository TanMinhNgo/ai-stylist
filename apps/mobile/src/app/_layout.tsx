import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useStudio } from '@/features/studio/store';
import { RequestError } from '@/lib/errors';
import { colors } from '@/theme';

const publishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  (() => {
    throw new Error('Thiếu EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY trong apps/mobile/.env');
  })();

// Treat app foreground as "focus": polling (e.g. try-on jobs) pauses in the background and refetches on return.
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
  return () => sub.remove();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx will not fix itself; only retry network and server failures.
      retry: (count, error) => count < 2 && error instanceof RequestError && error.retryable,
    },
  },
});

export default function RootLayout() {
  return (
    // tokenCache keeps the Clerk session in expo-secure-store.
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <RootStack />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function RootStack() {
  const { isLoaded, isSignedIn, userId } = useAuth();

  // Drop cached account data (queries, Studio picks/activeJob with private URLs) on sign-out or account switch.
  useEffect(() => {
    queryClient.clear();
    useStudio.getState().reset();
  }, [userId]);

  if (!isLoaded) return null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Protected guard={!!isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="photo-guide" />
        <Stack.Screen name="model-photos" />
        <Stack.Screen name="garment/[id]" />
        <Stack.Screen name="add-garment" />
        <Stack.Screen name="try-on/[jobId]" />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
