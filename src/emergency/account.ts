import { useEffect, useState } from 'react';

// Who is holding this device. Chosen once at setup and remembered on the device.
// It is also kept per tab, so two tabs can act as two crew members' devices in the demo.
// A real system would use proper sign-in; this prototype only picks a name.
const KEY = 'chiron-account';

function read(): string | undefined {
  try { return sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY) ?? undefined; } catch { return undefined; }
}

export function useAccount() {
  const [account, setAccount] = useState<string | undefined>(read);
  useEffect(() => {
    if (!account) return;
    try { sessionStorage.setItem(KEY, account); localStorage.setItem(KEY, account); } catch { /* ignore */ }
  }, [account]);
  return [account ?? 'ana', setAccount as (id: string) => void, account !== undefined] as const;
}
