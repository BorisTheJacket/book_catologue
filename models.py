from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()


class Novel(Base):
    __tablename__ = "novels"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    author = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    cover_image = Column(String(500), nullable=True)  # path to image file
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_published = Column(Boolean, default=True)

    chapters = relationship("Chapter", back_populates="novel", cascade="all, delete-orphan", order_by="Chapter.order")


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)  # plain text or markdown
    order = Column(Integer, default=0)

    novel = relationship("Novel", back_populates="chapters")


class WhitelistedUser(Base):
    __tablename__ = "whitelisted_users"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(String(50), unique=True, nullable=False)
    username = Column(String(100), nullable=True)
    first_name = Column(String(100), nullable=True)
    invite_token = Column(String(100), nullable=True)   # which token they used
    joined_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class InviteToken(Base):
    __tablename__ = "invite_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(100), unique=True, nullable=False)
    label = Column(String(100), nullable=True)          # e.g. "for friend John"
    is_single_use = Column(Boolean, default=False)
    used_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
