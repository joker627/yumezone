from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_active_user
from app.modules.users.models import User
from app.modules.admin.services import AdminService

router = APIRouter(tags=["Admin"])

def get_admin_service():
    return AdminService()

@router.post("/suspend")
async def suspend_user(
    user_id: int, 
    reason: str,
    service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(get_current_active_user)
):
    # TODO: Verify current_user is superadmin
    return {"message": f"User {user_id} suspended for: {reason}"}
