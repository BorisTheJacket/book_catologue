"""
Telegram bot — handles invite links and whitelisting.

Commands (send these in your private chat with the bot):
  /start <token>     — user clicks invite link, gets whitelisted
  /genlink [label]   — YOU generate a new invite link
  /genlink_once      — single-use invite link
  /links             — list all active tokens
  /revoke <token>    — deactivate a token
  /users             — list whitelisted users
  /removeuser <tid>  — remove a user from whitelist
"""

import asyncio
import os
import secrets
import logging
from aiogram import Bot, Dispatcher, F
from aiogram.types import Message
from aiogram.filters import CommandStart, Command, CommandObject
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from models import WhitelistedUser, InviteToken, Base
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
ADMIN_TELEGRAM_ID = os.getenv("ADMIN_TELEGRAM_ID", "")  # your personal TG id
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://your-app.com")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./novels.db")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def is_admin(message: Message) -> bool:
    return str(message.from_user.id) == ADMIN_TELEGRAM_ID


# ── /start ────────────────────────────────────────────────────────────────────

@dp.message(CommandStart())
async def cmd_start(message: Message, command: CommandObject):
    token = command.args  # token passed via t.me/bot?start=TOKEN

    if not token:
        await message.answer(
            "👋 Welcome! You need an invite link to access the reading app.\n"
            "Please ask the author for an invite."
        )
        return

    async with AsyncSessionLocal() as db:
        # Validate token
        result = await db.execute(
            select(InviteToken).where(
                InviteToken.token == token,
                InviteToken.is_active == True
            )
        )
        invite = result.scalar_one_or_none()

        if not invite:
            await message.answer("❌ This invite link is invalid or has expired.")
            return

        # Check if single-use and already used
        if invite.is_single_use and invite.used_count > 0:
            await message.answer("❌ This invite link has already been used.")
            return

        telegram_id = str(message.from_user.id)

        # Check if already whitelisted
        result = await db.execute(
            select(WhitelistedUser).where(WhitelistedUser.telegram_id == telegram_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            if not existing.is_active:
                existing.is_active = True
                await db.commit()
            await message.answer(
                f"✅ You already have access!\n\n"
                f"📖 <b>Open the Reading App</b>",
                parse_mode="HTML",
                reply_markup=build_app_button()
            )
            return

        # Whitelist user
        user = WhitelistedUser(
            telegram_id=telegram_id,
            username=message.from_user.username,
            first_name=message.from_user.first_name,
            invite_token=token,
        )
        db.add(user)

        # Update token usage
        invite.used_count += 1
        if invite.is_single_use:
            invite.is_active = False

        await db.commit()

    await message.answer(
        f"🎉 Welcome, {message.from_user.first_name}!\n"
        f"You now have access to the reading app.\n\n"
        f"📖 Tap below to start reading:",
        parse_mode="HTML",
        reply_markup=build_app_button()
    )


def build_app_button():
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="📚 Open Library",
            web_app=WebAppInfo(url=MINI_APP_URL)
        )
    ]])


# ── Admin: Generate invite link ───────────────────────────────────────────────

@dp.message(Command("genlink"))
async def cmd_genlink(message: Message, command: CommandObject):
    if not is_admin(message):
        return

    label = command.args or "general"
    token = secrets.token_urlsafe(16)

    async with AsyncSessionLocal() as db:
        invite = InviteToken(token=token, label=label, is_single_use=False)
        db.add(invite)
        await db.commit()

    link = f"https://t.me/{(await bot.get_me()).username}?start={token}"
    await message.answer(
        f"🔗 <b>New invite link</b> [{label}]\n\n"
        f"<code>{link}</code>\n\n"
        f"This link can be used multiple times.",
        parse_mode="HTML"
    )


@dp.message(Command("genlink_once"))
async def cmd_genlink_once(message: Message, command: CommandObject):
    if not is_admin(message):
        return

    label = command.args or "single-use"
    token = secrets.token_urlsafe(16)

    async with AsyncSessionLocal() as db:
        invite = InviteToken(token=token, label=label, is_single_use=True)
        db.add(invite)
        await db.commit()

    link = f"https://t.me/{(await bot.get_me()).username}?start={token}"
    await message.answer(
        f"🔗 <b>Single-use invite link</b> [{label}]\n\n"
        f"<code>{link}</code>\n\n"
        f"⚠️ This link works only once.",
        parse_mode="HTML"
    )


# ── Admin: List tokens ────────────────────────────────────────────────────────

@dp.message(Command("links"))
async def cmd_links(message: Message):
    if not is_admin(message):
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(InviteToken).where(InviteToken.is_active == True)
        )
        tokens = result.scalars().all()

    if not tokens:
        await message.answer("No active invite tokens.")
        return

    lines = ["<b>Active invite tokens:</b>\n"]
    bot_info = await bot.get_me()
    for t in tokens:
        link = f"https://t.me/{bot_info.username}?start={t.token}"
        single = "🔂 multi-use" if not t.is_single_use else f"1️⃣ single ({t.used_count} used)"
        lines.append(f"• <b>{t.label}</b> — {single}\n  <code>{link}</code>")

    await message.answer("\n".join(lines), parse_mode="HTML")


# ── Admin: Revoke token ───────────────────────────────────────────────────────

@dp.message(Command("revoke"))
async def cmd_revoke(message: Message, command: CommandObject):
    if not is_admin(message):
        return

    token = command.args
    if not token:
        await message.answer("Usage: /revoke <token>")
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(InviteToken).where(InviteToken.token == token)
        )
        invite = result.scalar_one_or_none()
        if not invite:
            await message.answer("Token not found.")
            return
        invite.is_active = False
        await db.commit()

    await message.answer(f"✅ Token <code>{token}</code> revoked.", parse_mode="HTML")


# ── Admin: List users ─────────────────────────────────────────────────────────

@dp.message(Command("users"))
async def cmd_users(message: Message):
    if not is_admin(message):
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WhitelistedUser).where(WhitelistedUser.is_active == True)
        )
        users = result.scalars().all()

    if not users:
        await message.answer("No whitelisted users.")
        return

    lines = [f"<b>Whitelisted users ({len(users)}):</b>\n"]
    for u in users:
        name = u.first_name or "?"
        uname = f"@{u.username}" if u.username else "no username"
        lines.append(f"• {name} ({uname}) — ID: <code>{u.telegram_id}</code>")

    await message.answer("\n".join(lines), parse_mode="HTML")


# ── Admin: Remove user ────────────────────────────────────────────────────────

@dp.message(Command("removeuser"))
async def cmd_removeuser(message: Message, command: CommandObject):
    if not is_admin(message):
        return

    telegram_id = command.args
    if not telegram_id:
        await message.answer("Usage: /removeuser <telegram_id>")
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WhitelistedUser).where(WhitelistedUser.telegram_id == telegram_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            await message.answer("User not found.")
            return
        user.is_active = False
        await db.commit()

    await message.answer(f"✅ User <code>{telegram_id}</code> removed.", parse_mode="HTML")


# ── Start bot ─────────────────────────────────────────────────────────────────

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
