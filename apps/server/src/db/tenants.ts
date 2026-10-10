import { hashPassword } from 'better-auth/crypto';
import { randomBytes } from 'node:crypto';
import { startOfDay } from '../lib/dates';
import type { Sql } from './client';
import { buildSalesStory } from './story-sales';
import { HELIOS_CLIENT_IDS } from './story-helios';

const oc = (orgId: string, clientId: string) =>
  `oc_${orgId.replace(/^org_/, '')}_${clientId}`.slice(0, 40);

/** Fixed demo tenants — passwords are for local/demo only. */
export const DEMO_PASSWORD = 'demo-password-1';

export const NORTHWIND = {
  orgId: 'org_northwind',
  name: 'Northwind Customer Success',
  slug: 'northwind-cs',
  userId: 'user_northwind_owner',
  email: 'owner@northwind.test',
  userName: 'Avery Chen',
  clientIds: ['acme', 'globex', 'initech', 'umbrella'] as const,
} as const;

export const HELIOS = {
  orgId: 'org_helios',
  name: 'Helios Account Management',
  slug: 'helios-am',
  userId: 'user_helios_owner',
  email: 'owner@helios.test',
  userName: 'Samira Qureshi',
  clientIds: HELIOS_CLIENT_IDS,
} as const;

export const DEMO_TENANTS = [NORTHWIND, HELIOS] as const;

/**
 * Clears prior tenant scaffolding and inserts two isolated orgs with owners,
 * client links, sample MOM, and action items. Story rows must already exist.
 */
export async function seedTenants(sql: Sql, schema: string): Promise<void> {
  const password = await hashPassword(DEMO_PASSWORD);
  const now = new Date();

  await sql.begin(async (tx) => {
    await tx`SELECT set_config('search_path', ${schema}, true)`;

    // Wipe org-scoped tables so reseeds never leave cross-tenant client links.
    await tx`
      TRUNCATE organization_audit_log, org_action_item, meeting_minutes,
        organization_invite, organization_client, organization_member,
        user_workspace_prefs, organization,
        sales_opportunity, marketing_campaign, marketing_channel_daily
      RESTART IDENTITY CASCADE`;

    // Remove previous demo users (keep any other auth users intact).
    for (const t of DEMO_TENANTS) {
      await tx`DELETE FROM account WHERE user_id = ${t.userId}`;
      await tx`DELETE FROM session WHERE user_id = ${t.userId}`;
      await tx`DELETE FROM "user" WHERE id = ${t.userId}`;
    }

    for (const t of DEMO_TENANTS) {
      await tx`
        INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
        VALUES (${t.userId}, ${t.userName}, ${t.email}, true, ${now}, ${now})`;
      // Better Auth matches credential accounts with account_id === user.id (not email).
      await tx`
        INSERT INTO account (
          id, account_id, provider_id, user_id, password, created_at, updated_at
        ) VALUES (
          ${`acc_${t.userId}`}, ${t.userId}, 'credential', ${t.userId}, ${password}, ${now}, ${now}
        )`;
      await tx`
        INSERT INTO organization (id, name, slug, created_at)
        VALUES (${t.orgId}, ${t.name}, ${t.slug}, ${now})`;
      await tx`
        INSERT INTO organization_member (id, organization_id, user_id, role, created_at)
        VALUES (${`mem_${t.userId}`}, ${t.orgId}, ${t.userId}, 'owner', ${now})`;
      await tx`
        INSERT INTO user_workspace_prefs (user_id, pinned, dismissed, active_organization_id, updated_at)
        VALUES (${t.userId}, ${tx.json([])}, ${tx.json([])}, ${t.orgId}, ${now})`;

      for (const clientId of t.clientIds) {
        await tx`
          INSERT INTO organization_client (id, organization_id, client_id, created_at)
          VALUES (${oc(t.orgId, clientId)}, ${t.orgId}, ${clientId}, ${now})`;
      }
    }

    // Sample MOM + action items per org (categories: meetings/MoM, commitments).
    await insertSampleMom(tx as unknown as Sql, now);
    await insertSalesMarketing(tx as unknown as Sql, startOfDay(now));
  });
}

async function insertSalesMarketing(tx: Sql, today: Date): Promise<void> {
  const s = buildSalesStory(today);
  if (s.opportunities.length) {
    await tx`INSERT INTO sales_opportunity ${tx(s.opportunities)}`;
  }
  if (s.campaigns.length) {
    await tx`INSERT INTO marketing_campaign ${tx(s.campaigns)}`;
  }
  const CHUNK = 500;
  for (let i = 0; i < s.channelDaily.length; i += CHUNK) {
    await tx`INSERT INTO marketing_channel_daily ${tx(s.channelDaily.slice(i, i + CHUNK))}`;
  }
}

async function insertSampleMom(tx: Sql, now: Date): Promise<void> {
  const heldNorth = new Date(now.getTime() - 3 * 86_400_000);
  const heldHelios = new Date(now.getTime() - 5 * 86_400_000);
  const dueSoon = new Date(now.getTime() + 4 * 86_400_000).toISOString().slice(0, 10);

  await tx`
    INSERT INTO meeting_minutes (
      id, organization_id, client_id, meeting_id, title, held_at, raw_text, summary,
      decisions, action_items, attendees, source, created_by, created_at
    ) VALUES (
      'mom_northwind_acme_1',
      ${NORTHWIND.orgId},
      'acme',
      'm1',
      'Acme export war-room',
      ${heldNorth},
      ${`Title: Acme export war-room
Attendees:
Maya Rao, Rohan Mehta, Dev Patel
Decisions:
- Prioritize CSV timeout hotfix before Q4 BR
Action items:
- Send status update (Maya Rao) due ${dueSoon}`},
      'War-room on export timeouts; hotfix prioritized before Q4 business review.',
      ${tx.json(['Prioritize CSV timeout hotfix before Q4 BR'])},
      ${tx.json([
        {
          id: 'mom_nw_ai1',
          text: 'Send status update on export hotfix',
          owner: 'Maya Rao',
          due: dueSoon,
          status: 'open',
        },
      ])},
      ${tx.json(['Maya Rao', 'Rohan Mehta', 'Dev Patel'])},
      'seed',
      ${NORTHWIND.userId},
      ${now}
    )`;

  await tx`
    INSERT INTO org_action_item (
      id, organization_id, meeting_minutes_id, client_id, text, owner, due, status, created_at, updated_at
    ) VALUES (
      'oai_northwind_1',
      ${NORTHWIND.orgId},
      'mom_northwind_acme_1',
      'acme',
      'Send status update on export hotfix',
      'Maya Rao',
      ${dueSoon},
      'open',
      ${now},
      ${now}
    )`;

  await tx`
    INSERT INTO meeting_minutes (
      id, organization_id, client_id, meeting_id, title, held_at, raw_text, summary,
      decisions, action_items, attendees, source, created_by, created_at
    ) VALUES (
      'mom_helios_vertex_1',
      ${HELIOS.orgId},
      'vertex',
      'h-m1',
      'Vertex alert latency review',
      ${heldHelios},
      ${`Title: Vertex alert latency review
Attendees:
Nina Okonkwo, Elena Vargas, Caleb Ng
Decisions:
- Ship interim mitigations before renewal session
Action items:
- Publish latency runbook (Nina Okonkwo) due ${dueSoon}`},
      'Reviewed fraud alert SLA risk; interim mitigations required before renewal.',
      ${tx.json(['Ship interim mitigations before renewal session'])},
      ${tx.json([
        {
          id: 'mom_hx_ai1',
          text: 'Publish latency runbook',
          owner: 'Nina Okonkwo',
          due: dueSoon,
          status: 'open',
        },
      ])},
      ${tx.json(['Nina Okonkwo', 'Elena Vargas', 'Caleb Ng'])},
      'seed',
      ${HELIOS.userId},
      ${now}
    )`;

  await tx`
    INSERT INTO org_action_item (
      id, organization_id, meeting_minutes_id, client_id, text, owner, due, status, created_at, updated_at
    ) VALUES (
      'oai_helios_1',
      ${HELIOS.orgId},
      'mom_helios_vertex_1',
      'vertex',
      'Publish latency runbook',
      'Nina Okonkwo',
      ${dueSoon},
      'open',
      ${now},
      ${now}
    ),
    (
      'oai_helios_2',
      ${HELIOS.orgId},
      'mom_helios_vertex_1',
      'vertex',
      'Hotfix settlement merchant_id column',
      'Caleb Ng',
      ${dueSoon},
      'open',
      ${now},
      ${now}
    )`;

  await tx`
    INSERT INTO organization_audit_log (
      id, organization_id, actor_user_id, action, entity_type, entity_id, detail, created_at
    ) VALUES
    (
      ${`aud_${randomBytes(4).toString('hex')}`},
      ${NORTHWIND.orgId},
      ${NORTHWIND.userId},
      'org.seeded',
      'organization',
      ${NORTHWIND.orgId},
      ${tx.json({ clients: NORTHWIND.clientIds.length })},
      ${now}
    ),
    (
      ${`aud_${randomBytes(4).toString('hex')}`},
      ${HELIOS.orgId},
      ${HELIOS.userId},
      'org.seeded',
      'organization',
      ${HELIOS.orgId},
      ${tx.json({ clients: HELIOS.clientIds.length })},
      ${now}
    )`;
}
