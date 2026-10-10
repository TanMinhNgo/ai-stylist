import { Redirect } from 'expo-router';

// Android reopens the app via the OAuth deep link (…/sso-callback) after Google/Apple sign-in;
// the session is already active by then, so just hand over to the auth guard.
export default function SsoCallback() {
  return <Redirect href="/" />;
}
