from pydantic import BaseModel


class NotificationPreferenceUpdate(BaseModel):
    notify_new_chapters: bool


class NotificationPreferenceResponse(BaseModel):
    work_id: int
    notify_new_chapters: bool
