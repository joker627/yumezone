from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class ChapterORM(Base):
    __tablename__ = "chapters"
    __table_args__ = (
        UniqueConstraint("work_id", "chapter_number", name="uq_work_chapter_number"),
        Index("idx_chapters_work_number", "work_id", "chapter_number"),
        Index("idx_chapters_status_published", "status", "published_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    work_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("works.id", ondelete="CASCADE"), nullable=False
    )
    scan_group_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("scan_groups.id", ondelete="SET NULL"), nullable=True
    )
    chapter_number: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PUBLISHED")
    translator_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reward_coins: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )


class ChapterImageORM(Base):
    __tablename__ = "chapter_images"
    __table_args__ = (
        UniqueConstraint("chapter_id", "order_number", name="uq_chapter_order"),
        Index("idx_ci_chapter_order", "chapter_id", "order_number"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chapter_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False
    )
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    order_number: Mapped[int] = mapped_column(Integer, nullable=False)


class ChapterSubmissionORM(Base):
    __tablename__ = "chapter_submissions"
    __table_args__ = (
        Index("idx_cs_status", "status"),
        Index("idx_cs_chapter", "chapter_id"),
        Index("idx_cs_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chapter_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    content_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    page_count: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reviewed_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

