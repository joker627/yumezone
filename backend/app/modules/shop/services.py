from typing import Any, Dict, List, Optional
from app.modules.shop.repository import ShopRepository


class ShopService:
    def __init__(self, repository: ShopRepository):
        self.repo = repository

    async def list_shop_items(self, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        return await self.repo.get_items(user_id)

    async def get_my_inventory(self, user_id: int) -> List[Dict[str, Any]]:
        return await self.repo.get_inventory(user_id)

    async def buy_item(self, user_id: int, item_id: int) -> int:
        return await self.repo.buy_item(user_id, item_id)

    async def equip_item(self, user_id: int, item_id: int) -> Dict[str, Any]:
        return await self.repo.equip_item(user_id, item_id)

    async def unequip_banner(self, user_id: int) -> None:
        await self.repo.unequip_banner(user_id)
