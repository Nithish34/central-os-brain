from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    organization_slug: Optional[str] = None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1)
    organization_name: str = Field(..., min_length=1)
    organization_slug: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    role: str
    organization_id: str
    organization_name: Optional[str] = None
    permissions: List[str] = []


class AuthResponse(BaseModel):
    user: UserResponse
    csrf_token: str
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    message: str = "Authenticated successfully"


class GoogleAuthRequest(BaseModel):
    credential: str
    organization_id: Optional[str] = None
    organization_slug: Optional[str] = None


class RoleUpdateRequest(BaseModel):
    role: str


class OAuthAuthorizeResponse(BaseModel):
    authorization_url: str
    state: str
