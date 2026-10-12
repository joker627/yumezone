from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

class ShopItemResponse(BaseModel):
    id: int
    category: str
    name: str
    description: Optional[str] = None
    price_coins: int
    preview_url: str
    required_level: int
    rarity: str
    is_owned: bool = False
    is_equipped: bool = False

class InventoryItemResponse(BaseModel):
    item_id: int
    category: str
    name: str
    description: Optional[str] = None
    preview_url: str
    rarity: str
    is_equipped: bool
    acquired_at: datetime

class BuyResponse(BaseModel):
    success: bool
    message: str
    new_coins: int
    item_id: int

class EquipResponse(BaseModel):
    success: bool
    message: str
    item_id: int
    banner_url: Optional[str] = None
