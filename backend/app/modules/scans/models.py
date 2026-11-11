from datetime import datetime
from typing import Any, Optional
from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class ScanGroupORM(Base):
    __tablename__ = "scan_groups"
    __table_args__ = (
        Index("idx_scans_slug", "slug"),
        Index("idx_scans_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    banner_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    social_links: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    report_methods: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    vault_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_contributed_tokens: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    clan_level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )


class ScanRoleORM(Base):
    __tablename__ = "scan_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)


class ScanGroupMemberORM(Base):
    __tablename__ = "scan_group_members"

    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("scan_groups.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(
        String(32), ForeignKey("scan_roles.code", onupdate="CASCADE"), nullable=False, default="UPLOADER"
    )
    permissions: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )


class ScanTreasuryTransactionORM(Base):
    __tablename__ = "scan_treasury_transactions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    scan_group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("scan_groups.id", ondelete="CASCADE"), nullable=False
    )
    actor_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    target_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    reference_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )


class ScanFundingGoalORM(Base):
    __tablename__ = "scan_funding_goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("scan_groups.id", ondelete="CASCADE"), nullable=False
    )
    work_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("works.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    target_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=25)
    current_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "scan_group_id": self.scan_group_id,
            "work_id": self.work_id,
            "title": self.title,
            "description": self.description,
            "target_tokens": self.target_tokens,
            "current_tokens": self.current_tokens,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
