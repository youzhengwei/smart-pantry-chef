import { useEffect } from 'react';

/**
 * Botpress integration removed — kept as a noop for API compatibility.
 * No runtime webchat will be loaded.
 */
export const useBotpressChat = (_showChat: boolean, _shoppingListFunctions?: any) => {
  useEffect(() => {
    // no-op
  }, [_showChat, _shoppingListFunctions]);
};
