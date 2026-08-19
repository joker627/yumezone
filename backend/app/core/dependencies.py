# imports external
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import aiomysql
import json
from typing import Optional
# imports internal
from app.core.database import get_db_pool
from app.core.security import decode_access_token
from app.modules.auth.repository import AuthRepository
from app.modules.users.models import User

security = HTTPBearer()

# Obtener usuario actual
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    # Decodificar token
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
        
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
        
    repository = AuthRepository()
    user = await repository.get_user_by_email(email)
    
    if user is None:
        raise credentials_exception
        
    return user

# Obtener usuario activo
async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.status.upper() != "ACTIVE":
        raise HTTPException(status_code=400, detail="Usuario inactivo")
    return current_user

# Obtener usuario administrador
async def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.platform_role.upper() not in ["ADMIN", "SUPERADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario no tiene permisos suficientes"
        )
    return current_user

# Verificar permisos de subida
async def verify_upload_permission(user: User, scan_group_id: Optional[int] = None):
    if user.platform_role.upper() in ["ADMIN", "SUPERADMIN"]:
        return True
    # Verificar si el usuario es miembro del grupo
    if scan_group_id:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT role, permissions FROM scan_group_members WHERE group_id = %s AND user_id = %s", (scan_group_id, user.id))
                member = await cur.fetchone()
                if not member:
                    raise HTTPException(status_code=403, detail="No perteneces a este grupo scan.")
                
                if member['role'] in ['ADMIN', 'MODERATOR']:
                    return True
                
                if member['permissions']:
                    perms = json.loads(member['permissions']) if isinstance(member['permissions'], str) else member['permissions']
                    if perms.get('can_upload'):
                        return True
                        
        raise HTTPException(status_code=403, detail="No tienes permisos para subir contenido en este grupo.")
    else:
        raise HTTPException(status_code=403, detail="Debes pertenecer a un grupo scan para subir contenido.")
