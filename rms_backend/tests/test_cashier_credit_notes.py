from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routes import cashier_routes as api


class Cursor:
    def __init__(self, rows):
        self.rows = rows

    def __aiter__(self):
        async def iterate():
            for row in self.rows:
                yield row
        return iterate()


class Sales:
    def __init__(self, rows):
        self.rows = rows

    @staticmethod
    def matches(row, query):
        for key, value in query.items():
            if isinstance(value, dict):
                if '$ne' in value and row.get(key) == value['$ne']:
                    return False
                if '$exists' in value and (key in row) != value['$exists']:
                    return False
            elif row.get(key) != value:
                return False
        return True

    async def find_one(self, query, **kwargs):
        return next((r for r in self.rows if self.matches(r, query)), None)

    def find(self, query, **kwargs):
        return Cursor([r for r in self.rows if self.matches(r, query)])

    async def update_one(self, query, update, **kwargs):
        row = await self.find_one(query)
        if row is None:
            return SimpleNamespace(modified_count=0)
        row.update(update.get('$set', {}))
        for key in update.get('$unset', {}):
            row.pop(key, None)
        return SimpleNamespace(modified_count=1)

    async def insert_one(self, doc):
        doc['_id'] = f"id-{len(self.rows)}"
        self.rows.append(doc)
        return SimpleNamespace(inserted_id=doc['_id'])


def client_with_sales(monkeypatch, rows):
    store = {'tenant_id': 't', 'store_id': 's', 'store_name': 'Store'}
    collection = Sales(rows)
    monkeypatch.setattr(api, 'sales_collection', collection)
    monkeypatch.setattr(api, '_require_store_context', AsyncMock(return_value=store))
    monkeypatch.setattr(api, '_generate_invoice_no', AsyncMock(side_effect=['CN-1', 'CN-2', 'INV-1', 'INV-2']))
    monkeypatch.setattr(api, '_get_product_info', AsyncMock(return_value={}))
    monkeypatch.setattr(api, '_apply_stock_change', AsyncMock(return_value={'updated': True}))
    monkeypatch.setattr(api, '_audit_pos', AsyncMock())
    app = FastAPI()
    app.include_router(api.router)
    return TestClient(app), collection


def test_partial_returns_use_original_discount_and_limit_quantities(monkeypatch):
    original = {'_id': 'sale', 'tenant_id': 't', 'store_id': 's', 'type': 'sale', 'invoice_no': 'SALE', 'items': [{'barcode': 'X', 'qty': 2, 'price': 300}], 'summary': {'net_payable': 500}}
    client, collection = client_with_sales(monkeypatch, [original])
    payload = {'terminalId': 'counter-1', 'terminalName': 'Counter 1', 'isReturn': True, 'originalInvoice': 'SALE', 'returnReason': 'Customer Return', 'items': [{'barcode': 'X', 'qty': -1, 'price': 250, 'total': -250}], 'summary': {'netPayable': 250}}
    assert client.post('/cashier/bill', json=payload).status_code == 201
    assert client.get('/cashier/bill/SALE').json()['data']['returned_quantities'] == {'X': 1}
    assert client.post('/cashier/bill', json=payload).status_code == 201
    assert client.post('/cashier/bill', json=payload).status_code == 400
    assert sum(r['summary']['net_payable'] for r in collection.rows if r['type'] == 'return') == 500


def test_credit_note_requires_equal_or_larger_purchase_and_cannot_be_reused(monkeypatch):
    note = {'_id': 'credit', 'tenant_id': 't', 'store_id': 's', 'type': 'return', 'invoice_no': 'CN', 'credit_note_only': True, 'summary': {'net_payable': 499}}
    client, collection = client_with_sales(monkeypatch, [note])
    payload = {'terminalId': 'counter-1', 'terminalName': 'Counter 1', 'items': [{'barcode': 'X', 'qty': 1, 'price': 400, 'total': 400}], 'summary': {'netPayable': 400}, 'bill': {'paymentMethod': 'Cash'}, 'exchangeCredit': {'amount': 499, 'againstInvoice': 'CN'}, 'paidAmount': 0}
    assert client.post('/cashier/bill', json=payload).status_code == 400
    assert not note.get('exchange_consumed')
    payload['items'][0].update(price=700, total=700)
    payload['summary']['netPayable'] = 700
    payload['paidAmount'] = 201
    assert client.post('/cashier/bill', json=payload).status_code == 201
    assert note['exchange_consumed']
    assert client.post('/cashier/bill', json=payload).status_code == 409
    assert len([r for r in collection.rows if r.get('type') == 'sale']) == 1


def test_credit_note_can_cover_purchase_exactly_and_old_refund_is_rejected(monkeypatch):
    note = {'_id': 'credit', 'tenant_id': 't', 'store_id': 's', 'type': 'return', 'invoice_no': 'CN', 'credit_note_only': True, 'summary': {'net_payable': 499}}
    old = {'_id': 'old', 'tenant_id': 't', 'store_id': 's', 'type': 'return', 'invoice_no': 'OLD', 'summary': {'net_payable': 499}}
    client, _ = client_with_sales(monkeypatch, [note, old])
    payload = {'terminalId': 'counter-1', 'terminalName': 'Counter 1', 'items': [{'barcode': 'X', 'qty': 1, 'price': 499, 'total': 499}], 'summary': {'netPayable': 499}, 'bill': {'paymentMethod': 'Cash'}, 'exchangeCredit': {'amount': 499, 'againstInvoice': 'OLD'}, 'paidAmount': 0}
    assert client.post('/cashier/bill', json=payload).status_code == 400
    payload['exchangeCredit']['againstInvoice'] = 'CN'
    assert client.post('/cashier/bill', json=payload).status_code == 201
    assert note['exchange_consumed']


def test_bills_and_credit_notes_require_terminal_identity(monkeypatch):
    client, collection = client_with_sales(monkeypatch, [])
    for payload in (
        {'items': [{'barcode': 'X', 'qty': 1, 'price': 499}], 'summary': {'netPayable': 499}},
        {'terminalId': 'counter-1', 'terminalName': '   ', 'isReturn': True},
        {'terminalName': 'Counter 1', 'syncSource': 'offline_pos'},
    ):
        response = client.post('/cashier/bill', json=payload)
        assert response.status_code == 400
        assert 'terminal' in response.json()['detail'].lower()
    assert collection.rows == []
