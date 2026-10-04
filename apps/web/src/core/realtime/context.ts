import { createContext } from 'react';
import type { RealtimeStatus } from './socket';

export interface RealtimeContextValue {
  status: RealtimeStatus;
}

export const RealtimeContext = createContext<RealtimeContextValue>({
  status: 'disconnected',
});
