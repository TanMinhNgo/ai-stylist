import { useSignIn, useSignUp } from '@clerk/expo';
import { useState } from 'react';

import { authMessage, clerkCode } from '@/features/auth/errors';

type Mode = 'signIn' | 'signUp';

/**
 * One email-code flow for both cases: sign in if the email has an account,
 * otherwise create it. The new session activates on finalize(), which flips the auth guard.
 */
export function useEmailCodeAuth() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(step: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await step();
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const ok = ({ error }: { error: unknown }) => {
    if (error) throw error;
  };

  const sendCode = (email: string) =>
    run(async () => {
      const sent = await signIn.emailCode.sendCode({ emailAddress: email.trim() });
      if (!sent.error) return setMode('signIn');
      if (clerkCode(sent.error) !== 'form_identifier_not_found') throw sent.error;
      ok(await signUp.create({ emailAddress: email.trim() }));
      ok(await signUp.verifications.sendEmailCode());
      setMode('signUp');
    });

  const verify = (code: string) =>
    run(async () => {
      if (mode === 'signIn') {
        ok(await signIn.emailCode.verifyCode({ code }));
        if (signIn.status !== 'complete') throw new Error('incomplete');
        ok(await signIn.finalize());
      } else {
        ok(await signUp.verifications.verifyEmailCode({ code }));
        if (signUp.status !== 'complete') throw new Error('incomplete');
        ok(await signUp.finalize());
      }
    });

  const resend = () => run(async () => ok(mode === 'signIn' ? await signIn.emailCode.sendCode() : await signUp.verifications.sendEmailCode()));

  const reset = () => {
    signIn.reset();
    setMode(null);
    setError(null);
  };

  return { awaitingCode: mode !== null, busy, error, sendCode, verify, resend, reset };
}
