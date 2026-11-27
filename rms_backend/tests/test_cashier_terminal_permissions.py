import asyncio
from unittest.mock import AsyncMock, patch

from app.routes.cashier_routes import _is_terminal_manager


def test_missing_identity_cannot_manage_terminal_roles():
    assert not asyncio.run(_is_terminal_manager({"scope": "store", "tenant_id": "t", "store_id": "s"}))


def test_cashier_and_suspended_admin_cannot_manage_roles():
    ctx = {"scope": "store", "tenant_id": "t", "store_id": "s", "admin_id": "64b000000000000000000001"}
    for admin in ({"department": "Cashier", "status": "ACTIVE"}, {"department": "Finance", "status": "SUSPENDED"}, None):
        with patch("app.routes.cashier_routes.admins_collection.find_one", new=AsyncMock(return_value=admin)):
            assert not asyncio.run(_is_terminal_manager(ctx))


def test_manager_lookup_is_limited_to_own_store_and_tenant():
    ctx = {"scope": "store", "tenant_id": "t", "store_id": "s", "admin_id": "64b000000000000000000001"}
    with patch("app.routes.cashier_routes.admins_collection.find_one", new=AsyncMock(return_value={"department": "Finance", "status": "ACTIVE"})) as lookup:
        assert asyncio.run(_is_terminal_manager(ctx))
        assert lookup.call_args.args[0]["tenant_id"] == "t"
        assert lookup.call_args.args[0]["store_id"] == "s"
