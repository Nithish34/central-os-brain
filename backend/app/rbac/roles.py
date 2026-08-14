from typing import Dict, List, Set

ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    "admin": {
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
        "system:read",
        "system:write",
    },
    "editor": {
        "integrations:read",
        "events:read",
        "conflicts:read",
        "conflicts:approve",
        "documents:read",
        "documents:write",
        "agents:read",
    },
    "viewer": {
        "integrations:read",
        "events:read",
        "conflicts:read",
        "documents:read",
        "agents:read",
    },
    "system": {
        "events:write",
        "integrations:write",
        "conflicts:read",
    }
}


def get_permissions_for_role(role: str) -> List[str]:
    return sorted(list(ROLE_PERMISSIONS.get(role, set())))
