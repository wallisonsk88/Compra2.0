from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import Quotation, Product, Supplier

router = APIRouter()

@router.get("/comparator")
def smart_compare(db: Session = Depends(get_db)):
    """ Retorna o melhor fornecedor para cada produto cotado. """
    products = db.query(Product).all()
    results = []

    for product in products:
        quotes = db.query(Quotation).filter(Quotation.product_id == product.id).order_by(Quotation.date.desc()).all()
        if not quotes:
            continue
        
        # Agrupar cotações mais recentes por fornecedor
        latest_quotes = {}
        for q in quotes:
            if q.supplier_id not in latest_quotes:
                latest_quotes[q.supplier_id] = q

        # Achar a menor cotação
        best_quote = min(latest_quotes.values(), key=lambda x: x.price)
        
        # Calcular economia em relação ao segundo menor preço ou média
        other_prices = [q.price for q in latest_quotes.values() if q.id != best_quote.id]
        savings = 0.0
        if other_prices:
            avg_others = sum(other_prices) / len(other_prices)
            savings = avg_others - best_quote.price

        results.append({
            "product_id": product.id,
            "product_name": product.name,
            "ean": product.ean,
            "best_supplier": best_quote.supplier.name,
            "best_price": best_quote.price,
            "savings": round(savings, 2),
            "date": best_quote.date
        })

    return results

@router.get("/generate")
def generate_order(db: Session = Depends(get_db)):
    """ Gera listas de compras separadas por fornecedor ideal. """
    best_deals = smart_compare(db)
    
    orders_by_supplier = {}
    total_savings = 0
    total_cost = 0

    for item in best_deals:
        supplier = item["best_supplier"]
        if supplier not in orders_by_supplier:
            orders_by_supplier[supplier] = {
                "items": [],
                "supplier_total": 0
            }
        
        orders_by_supplier[supplier]["items"].append({
            "product": item["product_name"],
            "price": item["best_price"],
            "savings": item["savings"]
        })
        orders_by_supplier[supplier]["supplier_total"] += item["best_price"]
        total_savings += item["savings"]
        total_cost += item["best_price"]

    return {
        "orders": orders_by_supplier,
        "summary": {
            "total_cost": round(total_cost, 2),
            "total_savings": round(total_savings, 2)
        }
    }

@router.get("/dashboard")
def get_dashboard_data(db: Session = Depends(get_db)):
    best_deals = smart_compare(db)
    total_savings = sum(item["savings"] for item in best_deals)
    
    quotes_count = db.query(Quotation).count()
    products_count = db.query(Product).count()
    suppliers_count = db.query(Supplier).count()

    return {
        "total_savings": round(total_savings, 2),
        "total_quotes": quotes_count,
        "total_products": products_count,
        "total_suppliers": suppliers_count,
        "recent_deals": sorted(best_deals, key=lambda x: x["savings"], reverse=True)[:5] # Top 5 economias
    }
