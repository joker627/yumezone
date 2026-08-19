from pydantic import BaseModel

class AdminAction(BaseModel):
    action: str
    target_id: int
    reason: str
