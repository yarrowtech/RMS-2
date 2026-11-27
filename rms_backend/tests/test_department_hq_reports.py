import asyncio
from unittest.mock import patch
from fastapi import HTTPException
from app.routes.hq_store_routes import hq_third_party_report
from app.routes.logistics_routes import logistics_report


class Cursor:
    def sort(self, *args):
        return self

    def limit(self, *args):
        return self

    def __aiter__(self):
        async def empty():
            if False:
                yield None
        return empty()

    async def to_list(self, length):
        return []


class Collection:
    def __init__(self):
        self.queries = []

    def find(self, query, projection):
        self.queries.append(query)
        return Cursor()


class LogisticsCollection(Collection):
    def find(self, query, *args):
        self.queries.append(query)
        return Cursor()

    async def count_documents(self, query):
        self.queries.append(query)
        return 0


def test_third_party_report_scopes_both_collections():
    vendors, bookings = Collection(), Collection()
    with patch("app.routes.hq_store_routes.db", {"thirdparty_vendors": vendors, "thirdparty_bookings": bookings}):
        data = asyncio.run(hq_third_party_report({"tenant_id": "tenant-a", "_managed_departments": ["Third Party"]}))
    assert vendors.queries == [{"tenant_id": "tenant-a"}]
    assert bookings.queries == [{"tenant_id": "tenant-a"}]
    assert "unassigned" in data["note"]


def test_third_party_report_requires_department():
    try:
        asyncio.run(hq_third_party_report({"tenant_id": "tenant-a", "_managed_departments": []}))
    except HTTPException as error:
        assert error.status_code == 403
    else:
        raise AssertionError("Unassigned department was allowed")


def test_logistics_report_scopes_counts_and_lists_to_tenant():
    orders, transfers = LogisticsCollection(), LogisticsCollection()
    with patch("app.routes.logistics_routes.purchaseorders_collection", orders), patch("app.routes.logistics_routes.stock_transfers_collection", transfers):
        report = asyncio.run(logistics_report({"tenant_id": "tenant-a"}))
    assert report["inbound_count"] == 0 and report["transfer_count"] == 0
    assert all(query["tenant_id"] == "tenant-a" for query in orders.queries + transfers.queries)
