from typing import Any, Dict, List, Optional
from sqlalchemy import and_, case, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import resolve_session
from app.modules.shop.models import (
    ShopItemORM,
    UserCoinTransactionORM,
    UserInventoryORM,
)
from app.modules.users.models import UserORM


class ShopRepository:
    def __init__(self, conn: Optional[AsyncSession] = None):
        self.conn = conn

    async def get_items(self, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            if user_id:
                stmt = (
                    select(
                        ShopItemORM.id,
                        ShopItemORM.category,
                        ShopItemORM.name,
                        ShopItemORM.description,
                        ShopItemORM.price_coins,
                        ShopItemORM.preview_url,
                        ShopItemORM.required_level,
                        ShopItemORM.rarity,
                        case((UserInventoryORM.id.is_not(None), True), else_=False).label(
                            "is_owned"
                        ),
                        case((UserInventoryORM.is_equipped.is_(True), True), else_=False).label(
                            "is_equipped"
                        ),
                    )
                    .outerjoin(
                        UserInventoryORM,
                        and_(
                            UserInventoryORM.item_id == ShopItemORM.id,
                            UserInventoryORM.user_id == user_id,
                        ),
                    )
                    .where(ShopItemORM.is_active.is_(True))
                    .order_by(
                        ShopItemORM.required_level.asc(),
                        ShopItemORM.price_coins.asc(),
                    )
                )
            else:
                stmt = (
                    select(
                        ShopItemORM.id,
                        ShopItemORM.category,
                        ShopItemORM.name,
                        ShopItemORM.description,
                        ShopItemORM.price_coins,
                        ShopItemORM.preview_url,
                        ShopItemORM.required_level,
                        ShopItemORM.rarity,
                    )
                    .where(ShopItemORM.is_active.is_(True))
                    .order_by(
                        ShopItemORM.required_level.asc(),
                        ShopItemORM.price_coins.asc(),
                    )
                )
            res = await session.execute(stmt)
            results = []
            for row in res.mappings().all():
                d = dict(row)
                d["is_owned"] = bool(d.get("is_owned", False))
                d["is_equipped"] = bool(d.get("is_equipped", False))
                results.append(d)
            return results

    async def get_item_by_id(self, item_id: int) -> Optional[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(ShopItemORM).where(
                    ShopItemORM.id == item_id, ShopItemORM.is_active.is_(True)
                )
            )
            item = res.scalar_one_or_none()
            return item.to_dict() if item else None

    async def get_inventory(self, user_id: int) -> List[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(
                    ShopItemORM.id.label("item_id"),
                    ShopItemORM.category,
                    ShopItemORM.name,
                    ShopItemORM.description,
                    ShopItemORM.preview_url,
                    ShopItemORM.rarity,
                    UserInventoryORM.is_equipped,
                    UserInventoryORM.acquired_at,
                )
                .join(ShopItemORM, ShopItemORM.id == UserInventoryORM.item_id)
                .where(UserInventoryORM.user_id == user_id)
                .order_by(UserInventoryORM.acquired_at.desc())
            )
            results = []
            for row in res.mappings().all():
                d = dict(row)
                d["is_equipped"] = bool(d.get("is_equipped", False))
                results.append(d)
            return results

    async def buy_item(self, user_id: int, item_id: int) -> int:
        async with resolve_session(self.conn) as session:
            item_res = await session.execute(
                select(ShopItemORM).where(
                    ShopItemORM.id == item_id, ShopItemORM.is_active.is_(True)
                )
            )
            item = item_res.scalar_one_or_none()
            if not item:
                raise ValueError("El item no existe o no está disponible.")

            owned_res = await session.execute(
                select(UserInventoryORM.id).where(
                    UserInventoryORM.user_id == user_id,
                    UserInventoryORM.item_id == item_id,
                )
            )
            if owned_res.scalar_one_or_none() is not None:
                raise ValueError("Ya posees este objeto en tu inventario.")

            user_res = await session.execute(
                select(UserORM).where(UserORM.id == user_id).with_for_update()
            )
            user = user_res.scalar_one_or_none()
            if not user:
                raise ValueError("Usuario no encontrado.")

            user_level = ((user.xp or 0) // 1000) + 1
            if user_level < item.required_level:
                raise ValueError(
                    f"Requiere Nivel {item.required_level} de lector (tu nivel actual: {user_level})."
                )

            price = item.price_coins
            if (user.coins or 0) < price:
                raise ValueError(
                    f"Monedas insuficientes. Cuesta {price} monedas y tienes {user.coins}."
                )

            new_coins = user.coins - price
            user.coins = new_coins

            session.add(
                UserInventoryORM(
                    user_id=user_id,
                    item_id=item_id,
                    is_equipped=False,
                )
            )
            session.add(
                UserCoinTransactionORM(
                    user_id=user_id,
                    amount=-price,
                    balance_after=new_coins,
                    type="SHOP_PURCHASE",
                    description=f"Compra en tienda: {item.name}",
                    reference_id=item_id,
                )
            )

            await session.commit()
            return new_coins

    async def equip_item(self, user_id: int, item_id: int) -> Dict[str, Any]:
        async with resolve_session(self.conn) as session:
            inv_res = await session.execute(
                select(
                    UserInventoryORM.id,
                    ShopItemORM.category,
                    ShopItemORM.name,
                    ShopItemORM.preview_url,
                )
                .join(ShopItemORM, ShopItemORM.id == UserInventoryORM.item_id)
                .where(
                    UserInventoryORM.user_id == user_id,
                    UserInventoryORM.item_id == item_id,
                )
            )
            inv_row = inv_res.mappings().first()
            if not inv_row:
                raise ValueError("No posees este item en tu inventario.")

            category = (inv_row["category"] or "").upper()
            name = inv_row["name"]
            preview_url = inv_row["preview_url"]

            await session.execute(
                text(
                    """
                    UPDATE user_inventory ui
                    SET is_equipped = FALSE
                    FROM shop_items si
                    WHERE ui.item_id = si.id
                      AND ui.user_id = :uid
                      AND UPPER(si.category) = :cat
                    """
                ),
                {"uid": user_id, "cat": category},
            )

            await session.execute(
                update(UserInventoryORM)
                .where(
                    UserInventoryORM.user_id == user_id,
                    UserInventoryORM.item_id == item_id,
                )
                .values(is_equipped=True)
            )

            if category == "BANNER":
                await session.execute(
                    update(UserORM)
                    .where(UserORM.id == user_id)
                    .values(banner_url=preview_url)
                )
            elif category == "FRAME":
                await session.execute(
                    update(UserORM)
                    .where(UserORM.id == user_id)
                    .values(avatar_frame_url=preview_url)
                )
            elif category == "AVATAR":
                await session.execute(
                    update(UserORM)
                    .where(UserORM.id == user_id)
                    .values(avatar_url=preview_url)
                )
            elif category == "TITLE":
                await session.execute(
                    update(UserORM)
                    .where(UserORM.id == user_id)
                    .values(active_title=name)
                )

            await session.commit()
            return {"preview_url": preview_url, "category": category}

    async def unequip_item(self, user_id: int, category: str = "BANNER") -> None:
        async with resolve_session(self.conn) as session:
            cat_upper = (category or "BANNER").upper()
            await session.execute(
                text(
                    """
                    UPDATE user_inventory ui
                    SET is_equipped = FALSE
                    FROM shop_items si
                    WHERE ui.item_id = si.id
                      AND ui.user_id = :uid
                      AND UPPER(si.category) = :cat
                    """
                ),
                {"uid": user_id, "cat": cat_upper},
            )
            if cat_upper == "BANNER":
                await session.execute(
                    update(UserORM)
                    .where(UserORM.id == user_id)
                    .values(banner_url=None)
                )
            elif cat_upper == "FRAME":
                await session.execute(
                    update(UserORM)
                    .where(UserORM.id == user_id)
                    .values(avatar_frame_url=None)
                )
            elif cat_upper == "AVATAR":
                await session.execute(
                    update(UserORM)
                    .where(UserORM.id == user_id)
                    .values(avatar_url=None)
                )
            elif cat_upper == "TITLE":
                await session.execute(
                    update(UserORM)
                    .where(UserORM.id == user_id)
                    .values(active_title=None)
                )

            await session.commit()

    async def unequip_banner(self, user_id: int) -> None:
        await self.unequip_item(user_id, "BANNER")
