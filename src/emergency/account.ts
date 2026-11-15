import { useState } from 'react';

// Authentication lasts only for this page session. Every reload starts at the shared dashboard.
export function useAccount() {
  const [account, setAccount] = useState('');
  return [account, setAccount, account !== ''] as const;
}
