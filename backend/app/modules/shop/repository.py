from typing import Optional, List, Dict, Any
import aiomysql
from app.core.database import get_db_pool

class ShopRepository:
    async def get_items(self, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                if user_id:
                    await cur.execute("""
                        SELECT 
                            si.id, si.category, si.name, si.description, 
                            si.price_coins, si.preview_url, si.required_level, si.rarity,
                            CASE WHEN ui.id IS NOT NULL THEN 1 ELSE 0 END AS is_owned,
                            CASE WHEN ui.is_equipped = 1 THEN 1 ELSE 0 END AS is_equipped
                        FROM shop_items si
                        LEFT JOIN user_inventory ui ON ui.item_id = si.id AND ui.user_id = %s
                        WHERE si.is_active = TRUE
                        ORDER BY si.required_level ASC, si.price_coins ASC
                    """, (user_id,))
                else:
                    await cur.execute("""
                        SELECT 
                            si.id, si.category, si.name, si.description, 
                            si.price_coins, si.preview_url, si.required_level, si.rarity,
                            0 AS is_owned,
                            0 AS is_equipped
                        FROM shop_items si
                        WHERE si.is_active = TRUE
                        ORDER BY si.required_level ASC, si.price_coins ASC
                    """)
                results = await cur.fetchall() or []
                for r in results:
                    r["is_owned"] = bool(r["is_owned"])
                    r["is_equipped"] = bool(r["is_equipped"])
                return results

    async def get_item_by_id(self, item_id: int) -> Optional[Dict[str, Any]]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT * FROM shop_items WHERE id = %s AND is_active = TRUE", (item_id,))
                return await cur.fetchone()

    async def get_inventory(self, user_id: int) -> List[Dict[str, Any]]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("""
                    SELECT 
                        si.id AS item_id, si.category, si.name, si.description,
                        si.preview_url, si.rarity, ui.is_equipped, ui.acquired_at
                    FROM user_inventory ui
                    JOIN shop_items si ON si.id = ui.item_id
                    WHERE ui.user_id = %s
                    ORDER BY ui.acquired_at DESC
                """, (user_id,))
                results = await cur.fetchall() or []
                for r in results:
                    r["is_equipped"] = bool(r["is_equipped"])
                return results

    async def buy_item(self, user_id: int, item_id: int) -> int:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                # 1. Obtener item
                await cur.execute("SELECT * FROM shop_items WHERE id = %s AND is_active = TRUE", (item_id,))
                item = await cur.fetchone()
                if not item:
                    raise ValueError("El item no existe o no está disponible.")

                # 2. Verificar si ya lo tiene
                await cur.execute("SELECT id FROM user_inventory WHERE user_id = %s AND item_id = %s", (user_id, item_id))
                if await cur.fetchone():
                    raise ValueError("Ya posees este objeto en tu inventario.")

                # 3. Obtener monedas y nivel del usuario
                await cur.execute("SELECT coins, xp FROM users WHERE id = %s FOR UPDATE", (user_id,))
                user = await cur.fetchone()
                if not user:
                    raise ValueError("Usuario no encontrado.")

                user_level = (user["xp"] // 1000) + 1
                if user_level < item["required_level"]:
                    raise ValueError(f"Requiere Nivel {item['required_level']} de lector (tu nivel actual: {user_level}).")

                price = item["price_coins"]
                if user["coins"] < price:
                    raise ValueError(f"Monedas insuficientes. Cuesta {price} monedas y tienes {user['coins']}.")

                # 4. Descontar monedas
                new_coins = user["coins"] - price
                await cur.execute("UPDATE users SET coins = %s WHERE id = %s", (new_coins, user_id))

                # 5. Agregar al inventario
                await cur.execute("""
                    INSERT INTO user_inventory (user_id, item_id, is_equipped)
                    VALUES (%s, %s, FALSE)
                """, (user_id, item_id))

                await conn.commit()
                return new_coins

    async def equip_item(self, user_id: int, item_id: int) -> str:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                # Verificar propiedad
                await cur.execute("""
                    SELECT ui.id, si.category, si.preview_url 
                    FROM user_inventory ui
                    JOIN shop_items si ON si.id = ui.item_id
                    WHERE ui.user_id = %s AND ui.item_id = %s
                """, (user_id, item_id))
                inv_row = await cur.fetchone()
                if not inv_row:
                    raise ValueError("No posees este item en tu inventario.")

                category = inv_row["category"]
                preview_url = inv_row["preview_url"]

                # Desequipar otros items de la misma categoría
                await cur.execute("""
                    UPDATE user_inventory ui
                    JOIN shop_items si ON si.id = ui.item_id
                    SET ui.is_equipped = FALSE
                    WHERE ui.user_id = %s AND si.category = %s
                """, (user_id, category))

                # Equipar este item
                await cur.execute("""
                    UPDATE user_inventory SET is_equipped = TRUE
                    WHERE user_id = %s AND item_id = %s
                """, (user_id, item_id))

                # Si es un banner, actualizar banner_url en users
                if category == "BANNER":
                    await cur.execute("UPDATE users SET banner_url = %s WHERE id = %s", (preview_url, user_id))

                await conn.commit()
                return preview_url

    async def unequip_banner(self, user_id: int) -> None:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                    UPDATE user_inventory ui
                    JOIN shop_items si ON si.id = ui.item_id
                    SET ui.is_equipped = FALSE
                    WHERE ui.user_id = %s AND si.category = 'BANNER'
                """, (user_id,))
                await cur.execute("UPDATE users SET banner_url = NULL WHERE id = %s", (user_id,))
                await conn.commit()
