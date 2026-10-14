from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.dependencies import get_current_user, get_optional_current_user, CurrentUser
from app.modules.shop.repository import ShopRepository
from app.modules.shop.schemas import ShopItemResponse, InventoryItemResponse, BuyResponse, EquipResponse

router = APIRouter(tags=["shop"])
repo = ShopRepository()

@router.get("/items", response_model=List[ShopItemResponse])
async def list_shop_items(current_user: Optional[CurrentUser] = Depends(get_optional_current_user)):
    """Lista todos los items disponibles en la tienda con estado de propiedad si está autenticado."""
    user_id = current_user.id if current_user else None
    items = await repo.get_items(user_id)
    return [ShopItemResponse(**item) for item in items]

@router.get("/inventory", response_model=List[InventoryItemResponse])
async def get_my_inventory(current_user: CurrentUser = Depends(get_current_user)):
    """Lista el inventario de personalización del usuario autenticado."""
    inv = await repo.get_inventory(current_user.id)
    return [InventoryItemResponse(**item) for item in inv]

@router.post("/buy/{item_id}", response_model=BuyResponse)
async def buy_shop_item(item_id: int, current_user: CurrentUser = Depends(get_current_user)):
    """Compra un fondo de banner u objeto cosmético con monedas reales."""
    try:
        new_coins = await repo.buy_item(current_user.id, item_id)
        return BuyResponse(
            success=True,
            message="¡Artículo adquirido con éxito! Ya está disponible en tu inventario.",
            new_coins=new_coins,
            item_id=item_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al procesar la compra: {str(e)}")

@router.post("/equip/{item_id}", response_model=EquipResponse)
async def equip_shop_item(item_id: int, current_user: CurrentUser = Depends(get_current_user)):
    try:
        res = await repo.equip_item(current_user.id, item_id)
        preview_url = res["preview_url"]
        category = res["category"]
        return EquipResponse(
            success=True,
            message="¡Artículo equipado exitosamente!",
            item_id=item_id,
            preview_url=preview_url,
            banner_url=preview_url if category == "BANNER" else None,
            anillo_url=preview_url if category == "FRAME" else None,
            avatar_frame_url=preview_url if category == "FRAME" else None,
            category=category
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al equipar el item: {str(e)}")

@router.post("/unequip")
async def unequip_current_banner(current_user: CurrentUser = Depends(get_current_user)):
    """Desequipa el banner actual y restaura el fondo por defecto."""
    await repo.unequip_banner(current_user.id)
    return {"success": True, "message": "Fondo por defecto restaurado."}
