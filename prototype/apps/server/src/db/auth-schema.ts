import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';
import { env } from '../env';

/** Auth + prefs tables live in DB_SCHEMA alongside story data (never in public). */
export const appSchema = pgSchema(env.DB_SCHEMA);

export const user = appSchema.table('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = appSchema.table('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .$onUpdate(() => new Date())
    .notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = appSchema.table('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .$onUpdate(() => new Date())
    .notNull(),
});

export const verification = appSchema.table('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const organization = appSchema.table('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const organizationMember = appSchema.table('organization_member', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').$type<'owner' | 'admin' | 'member'>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const organizationInvite = appSchema.table('organization_invite', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  code: text('code').notNull().unique(),
  role: text('role').$type<'admin' | 'member'>().notNull().default('member'),
  expiresAt: timestamp('expires_at').notNull(),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type MomActionItem = {
  id: string;
  text: string;
  owner: string | null;
  due: string | null;
  status: 'open' | 'done' | 'missed';
};

export const meetingMinutes = appSchema.table('meeting_minutes', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  clientId: text('client_id'),
  meetingId: text('meeting_id'),
  title: text('title').notNull(),
  heldAt: timestamp('held_at').notNull(),
  rawText: text('raw_text').notNull(),
  summary: text('summary'),
  decisions: jsonb('decisions').$type<string[]>().notNull().default([]),
  actionItems: jsonb('action_items').$type<MomActionItem[]>().notNull().default([]),
  attendees: jsonb('attendees').$type<string[]>().notNull().default([]),
  source: text('source').notNull().default('paste'),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const organizationClient = appSchema.table('organization_client', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orgActionItem = appSchema.table('org_action_item', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  meetingMinutesId: text('meeting_minutes_id').references(() => meetingMinutes.id, {
    onDelete: 'set null',
  }),
  clientId: text('client_id'),
  text: text('text').notNull(),
  owner: text('owner'),
  due: text('due'),
  status: text('status').$type<'open' | 'done' | 'missed'>().notNull().default('open'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const organizationAuditLog = appSchema.table('organization_audit_log', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  actorUserId: text('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userWorkspacePrefs = appSchema.table('user_workspace_prefs', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  pinned: jsonb('pinned').$type<string[]>().notNull().default([]),
  dismissed: jsonb('dismissed').$type<string[]>().notNull().default([]),
  activeOrganizationId: text('active_organization_id').references(() => organization.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  workspacePrefs: one(userWorkspacePrefs),
  memberships: many(organizationMember),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const userWorkspacePrefsRelations = relations(userWorkspacePrefs, ({ one }) => ({
  user: one(user, { fields: [userWorkspacePrefs.userId], references: [user.id] }),
}));
