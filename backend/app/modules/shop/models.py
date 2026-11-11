from datetime import date, datetime
from typing import Optional
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class UserCoinTransactionORM(Base):
    __tablename__ = "user_coin_transactions"
    __table_args__ = (
        Index("idx_uct_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reference_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )


class DailyMissionORM(Base):
    __tablename__ = "daily_missions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mission_key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="LECTURA")
    mission_type: Mapped[str] = mapped_column(String(20), nullable=False, default="DAILY")
    event_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    icon: Mapped[str] = mapped_column(String(50), nullable=False, default="book-open")
    target_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    condition_type: Mapped[str] = mapped_column(String(40), nullable=False)
    reward_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    reward_coins: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    reward_clan_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    action_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, default="/pages/catalogo.html")
    action_text: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="Explorar obras")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class UserDailyMissionORM(Base):
    __tablename__ = "user_daily_missions"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "mission_key", "claimed_date", name="uq_user_mission_date"
        ),
        Index("idx_udm_user_date", "user_id", "claimed_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    mission_key: Mapped[str] = mapped_column(String(50), nullable=False)
    claimed_date: Mapped[date] = mapped_column(Date, nullable=False)
    xp_awarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    coins_awarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clan_tokens_awarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    claimed_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )


class ShopItemORM(Base):
    __tablename__ = "shop_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="BANNER")
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    price_coins: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    preview_url: Mapped[str] = mapped_column(String(500), nullable=False)
    required_level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    rarity: Mapped[str] = mapped_column(String(30), nullable=False, default="RARE")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )


class UserInventoryORM(Base):
    __tablename__ = "user_inventory"
    __table_args__ = (
        UniqueConstraint("user_id", "item_id", name="uq_user_item"),
        Index("idx_user_inventory_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("shop_items.id", ondelete="CASCADE"), nullable=False
    )
    is_equipped: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    acquired_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
