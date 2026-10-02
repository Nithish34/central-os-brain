from fastapi import Depends, HTTPException, status
from app.auth.dependencies import get_current_user
from app.auth.schemas import UserResponse


def require_permission(permission: str):
    def permission_checker(user: UserResponse = Depends(get_current_user)) -> UserResponse:
        if permission not in user.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Missing required permission '{permission}'",
            )
        return user
    return permission_checker
