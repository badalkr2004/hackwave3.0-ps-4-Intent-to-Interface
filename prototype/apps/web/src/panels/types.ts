import { createContext } from 'react';
import type { ComponentId, PanelProps, Size } from '@gestalt/shared';

export interface PanelViewProps<K extends ComponentId> {
  props: PanelProps<K>;
  size: Size;
  lens: boolean;
}

export type ActionItem = PanelProps<'action_bar'>['actions'][number];

export interface PanelActions {
  runAction: (action: ActionItem) => void;
}

export const PanelActionsContext = createContext<PanelActions>({ runAction: () => {} });
