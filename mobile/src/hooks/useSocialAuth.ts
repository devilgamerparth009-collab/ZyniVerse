import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../services/api';

/**
 * Session guard for the social screens. Re-checks on focus so signing in from
 * the modal immediately unlocks the screen when the user comes back.
 */
export function useSocialAuth() {
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  const check = useCallback(async () => {
    const ok = await api.auth.isLoggedIn().catch(() => false);
    setSignedIn(ok);
    setChecking(false);
    return ok;
  }, []);

  useFocusEffect(
    useCallback(() => {
      void check();
    }, [check])
  );

  return { checking, signedIn, recheck: check };
}
