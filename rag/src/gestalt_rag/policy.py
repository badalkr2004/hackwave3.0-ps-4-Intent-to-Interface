from gestalt_rag.schemas import AccessRole, AccessTier, ChatBlockType

# access_tier values each role may retrieve
ROLE_TIERS: dict[AccessRole, list[str]] = {
    AccessRole.manager: [
        AccessTier.public.value,
        AccessTier.engineering.value,
        AccessTier.management.value,
    ],
    AccessRole.developer: [
        AccessTier.public.value,
        AccessTier.engineering.value,
    ],
    AccessRole.intern: [AccessTier.public.value],
}

ROLE_BLOCK_ALLOWLIST: dict[AccessRole, set[ChatBlockType]] = {
    AccessRole.manager: set(ChatBlockType),
    AccessRole.developer: {
        ChatBlockType.open_issues,
        ChatBlockType.jira_tickets,
        ChatBlockType.hypothesis_list,
        ChatBlockType.last_meeting_recap,
        ChatBlockType.client_snapshot,
    },
    AccessRole.intern: {
        ChatBlockType.talking_points,
        ChatBlockType.last_meeting_recap,
        ChatBlockType.client_snapshot,
        ChatBlockType.open_issues,
    },
}


def tiers_for(role: AccessRole) -> list[str]:
    return ROLE_TIERS[role]


def filter_blocks_for_role(role: AccessRole, block_types: list[ChatBlockType]) -> list[ChatBlockType]:
    allow = ROLE_BLOCK_ALLOWLIST[role]
    return [b for b in block_types if b in allow]
