import { useEffect, useRef, useState } from 'react';
import type { Deal } from '../../domain/deal';
import { CURRENT_USER_ID } from '../../domain/users';

const FLASH_MS = 2000;

/**
 * True for a moment after a teammate changes this deal, so the row can
 * highlight briefly. Our own changes don't flash: the user already knows.
 */
export function useTeammateFlash(deal: Deal | undefined): boolean {
  const [flashing, setFlashing] = useState(false);
  const seenVersion = useRef(deal?.version);

  useEffect(() => {
    if (!deal || deal.version === seenVersion.current) return;
    seenVersion.current = deal.version;

    const byTeammate = deal.updatedBy !== CURRENT_USER_ID;
    setFlashing(byTeammate);
    if (!byTeammate) return;

    const timer = setTimeout(() => setFlashing(false), FLASH_MS);
    return () => clearTimeout(timer);
  }, [deal]);

  return flashing;
}
