import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { RequestError } from '@/lib/errors';
import { colors } from '@/theme';

const publishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  (() => {
    throw new Error('Thiếu EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY trong apps/mobile/.env');
  })();

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
  const { isLoaded, isSignedIn } = useAuth();

  // Drop cached account data when the session ends.
  useEffect(() => {
    if (!isSignedIn) queryClient.clear();
  }, [isSignedIn]);

  if (!isLoaded) return null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Protected guard={!!isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="photo-guide" />
        <Stack.Screen name="model-photos" />
        <Stack.Screen name="garment/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
