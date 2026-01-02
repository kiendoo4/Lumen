from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.utils.auth import decode_access_token

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Authentication dependency - equivalent to Flask's @login_required decorator.
    
    Use this with Depends() in FastAPI route handlers to require authentication.
    If token is missing or invalid, automatically returns 401 Unauthorized.
    
    Example:
        @router.get("/protected")
        async def protected_route(current_user: dict = Depends(get_current_user)):
            return {"user_id": current_user["userId"]}
    
    Returns:
        dict: User information with keys: userId, username, email
    
    Raises:
        HTTPException: 401 if token is missing or invalid
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    user_id: int = payload.get("userId")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    return {"userId": user_id, "username": payload.get("username"), "email": payload.get("email")}

# Alias for easier import (Flask-like naming)
login_required = get_current_user


