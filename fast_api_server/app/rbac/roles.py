from typing import Dict, List, Set

ROLE_HIERARCHY: Dict[str, int] = {
    "owner": 100,
    "admin": 80,
    "manager": 60,
    "employee": 40,
    "agent": 30,
}

ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    "owner": {
        "org:admin",
        "org:delete",
        "users:manage",
        "roles:manage",
        "integrations:read",
        "integrations:write",
        "integrations:delete",
        "events:read",
        "events:write",
        "conflicts:read",
        "conflicts:approve",
        "conflicts:reject",
        "documents:read",
        "documents:write",
        "documents:delete",
        "agents:read",
        "agents:write",
        "audit:read",
        "workflows:execute",
    },
    "admin": {
        "org:admin",
        "users:manage",
        "roles:manage",
        "integrations:read",
        "integrations:write",
        "events:read",
        "events:write",
        "conflicts:read",
        "conflicts:approve",
        "conflicts:reject",
        "documents:read",
        "documents:write",
        "agents:read",
        "agents:write",
        "audit:read",
        "workflows:execute",
    },
    "manager": {
        "integrations:read",
        "events:read",
        "events:write",
        "conflicts:read",
        "conflicts:approve",
        "conflicts:reject",
        "documents:read",
        "documents:write",
        "agents:read",
        "audit:read",
        "workflows:execute",
    },
    "employee": {
        "integrations:read",
        "events:read",
        "conflicts:read",
        "documents:read",
        "agents:read",
    },
    "agent": {
        "events:read",
        "events:write",
        "documents:read",
        "conflicts:read",
        "conflicts:write",
        "workflows:execute",
    },
}


def get_permissions_for_role(role: str) -> List[str]:
    return sorted(list(ROLE_PERMISSIONS.get(role, set())))


def has_role_level(user_role: str, required_role: str) -> bool:
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    req_level = ROLE_HIERARCHY.get(required_role, 0)
    return user_level >= req_level
