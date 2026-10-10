import axios, { type AxiosRequestConfig } from 'axios';

import { RequestError, toRequestError } from '@/lib/errors';

// npm run dev injects the LAN address of the API for this run.
export const api = axios.create({ baseURL: process.env.EXPO_PUBLIC_API_URL, timeout: 15_000 });

type Schema<T> = { safeParse(data: unknown): { success: true; data: T } | { success: false } };

/** Call the API and parse the body with its @stylist/shared schema; every failure becomes a RequestError. */
export async function request<T>(schema: Schema<T>, config: AxiosRequestConfig): Promise<T> {
  let data: unknown;
  try {
    data = (await api.request(config)).data;
  } catch (error) {
    throw toRequestError(error);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new RequestError('BAD_RESPONSE');
  return parsed.data;
}
