import { getClerkInstance } from '@clerk/expo';
import axios, { type AxiosRequestConfig } from 'axios';

import { RequestError, toRequestError } from '@/lib/errors';

// npm run dev injects the LAN address of the API for this run.
export const api = axios.create({ baseURL: process.env.EXPO_PUBLIC_API_URL, timeout: 15_000 });

// Read the token from the Clerk singleton at send time, so a request fired during the first
// render after sign-in still carries it (no dependency on React effect order).
api.interceptors.request.use(async (config) => {
  const token = await getClerkInstance().session?.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type Schema<T> = { safeParse(data: unknown): { success: true; data: T } | { success: false } };

/** Call the API and parse the body with its @stylist/shared schema; every failure becomes a RequestError. */
export async function request<T>(schema: Schema<T>, config: AxiosRequestConfig): Promise<T> {
  let data: unknown;
  try {
    data = (await api.request(config)).data;
  } catch (error) {
    const failure = toRequestError(error);
    // Only a token the API rejected means the session is dead; a request sent without one does not.
    const sentToken = axios.isAxiosError(error) && !!error.config?.headers?.Authorization;
    if (failure.code === 'UNAUTHORIZED' && sentToken) void getClerkInstance().signOut();
    throw failure;
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new RequestError('BAD_RESPONSE');
  return parsed.data;
}
