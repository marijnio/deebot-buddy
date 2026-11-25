"""Pydantic request and response schemas for Deebot Buddy."""

from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


class CompleteTaskRequest(BaseModel):
    action_type: Literal["CLEAN", "REPLACE"]
    performed_at: Optional[str] = None
    notes: str = Field(default="", max_length=1000)


class UpdateTaskRequest(BaseModel):
    clean_interval_days: Optional[int] = Field(default=None, ge=1, le=3650)
    replace_interval_days: Optional[int] = Field(default=None, ge=1, le=3650)
    clean_due_override: Optional[str] = None
    replace_due_override: Optional[str] = None
    clear_clean_override: bool = False
    clear_replace_override: bool = False
    snooze_clean_days: Optional[int] = Field(default=None, ge=1, le=365)
    snooze_replace_days: Optional[int] = Field(default=None, ge=1, le=365)
    mark_clean_due: bool = False
    mark_replace_due: bool = False


class BulkFlagTasksRequest(BaseModel):
    scope: Literal["clean_and_bag", "clean_only", "all_cycles", "replace_only"] = (
        "clean_and_bag"
    )
    urgency: Literal["overdue", "due_soon"] = "overdue"
    only_unlogged: bool = False
    task_ids: Optional[list[int]] = None


class UpdateInventoryRequest(BaseModel):
    in_stock: Optional[int] = Field(default=None, ge=0, le=9999)
    delta: Optional[int] = Field(default=None, ge=-1000, le=1000)
    low_stock_threshold: Optional[int] = Field(default=None, ge=0, le=999)
    notes: Optional[str] = Field(default=None, max_length=500)


class SettingsUpdateRequest(BaseModel):
    robot_name: Optional[str] = Field(default=None, max_length=80)
    webhook_url: Optional[str] = Field(default=None, max_length=1000)
    webhook_type: Optional[
        Literal["auto", "discord", "pushover", "gotify", "home_assistant", "generic"]
    ] = None
    pushover_token: Optional[str] = Field(default=None, max_length=200)
    pushover_user: Optional[str] = Field(default=None, max_length=200)
    notifications_enabled: Optional[bool] = None


class TestWebhookRequest(BaseModel):
    webhook_url: Optional[str] = Field(default=None, max_length=1000)
    webhook_type: Optional[
        Literal["auto", "discord", "pushover", "gotify", "home_assistant", "generic"]
    ] = None
    pushover_token: Optional[str] = Field(default=None, max_length=200)
    pushover_user: Optional[str] = Field(default=None, max_length=200)


class BackupPayload(BaseModel):
    version: int = 1
    exported_at: Optional[str] = None
    inventory: list[dict[str, Any]]
    tasks: list[dict[str, Any]]
    maintenance_logs: list[dict[str, Any]] = Field(default_factory=list)
    settings: dict[str, str] = Field(default_factory=dict)


class LoginRequest(BaseModel):
    password: str = Field(min_length=1, max_length=200)
    remember_me: bool = True


class PasswordUpdateRequest(BaseModel):
    current_password: Optional[str] = Field(default=None, max_length=200)
    new_password: Optional[str] = Field(default=None, max_length=200)
