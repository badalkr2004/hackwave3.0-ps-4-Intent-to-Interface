import { z } from 'zod';
import { ClientRef, ProjectRef, UISpec } from './schemas';

export const DEMO_PROMPTS = [
  'I need to prepare tomorrow’s client meeting with Acme.',
  'Wait, why did their usage drop?',
  'Show me everything overdue across all projects.',
  'look into Acme',
] as const;

export const SessionResponse = z.object({
  sessionId: z.string(),
  entities: z.object({ clients: z.array(ClientRef), projects: z.array(ProjectRef) }),
  demoPrompts: z.array(z.string()),
  spec: UISpec,
});
export type SessionResponse = z.infer<typeof SessionResponse>;

export const ComposeRequest = z.object({
  text: z.string().max(500),
  requestId: z.string().min(1).max(100),
});
export type ComposeRequest = z.infer<typeof ComposeRequest>;

export const ResolveRequest = z.object({
  interpretationId: z.string().min(1),
  requestId: z.string().min(1).max(100),
});
export type ResolveRequest = z.infer<typeof ResolveRequest>;

export const PinRequest = z.object({ componentId: z.string().min(1), pinned: z.boolean() });
export type PinRequest = z.infer<typeof PinRequest>;

export const DismissRequest = z.object({ componentId: z.string().min(1) });
export type DismissRequest = z.infer<typeof DismissRequest>;

export const SpecResponse = z.object({ spec: UISpec });
export type SpecResponse = z.infer<typeof SpecResponse>;
