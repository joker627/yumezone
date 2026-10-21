from pydantic import BaseModel


class ClaimMissionPayload(BaseModel):
    mission_key: str
