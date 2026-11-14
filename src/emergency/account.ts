import { useEffect, useState } from 'react';

// Who is holding this device. Stored per tab, so two tabs can act as two crew members' devices.
// A real system would use proper sign-in; this prototype only picks a name.
const KEY = 'chiron-account';

export function useAccount() {
  const [account, setAccount] = useState<string>(() => {
    try { return sessionStorage.getItem(KEY) ?? 'ana'; } catch { return 'ana'; }
  });
  useEffect(() => { try { sessionStorage.setItem(KEY, account); } catch { /* ignore */ } }, [account]);
  return [account, setAccount] as const;
}
