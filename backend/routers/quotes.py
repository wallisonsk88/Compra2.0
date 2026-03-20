from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database.database import get_db
from database.models import Quotation, Product, Supplier
from schemas.schemas import QuotationCreate, QuotationResponse
import datetime

router = APIRouter()

@router.get("/", response_model=List[QuotationResponse])
def read_quotations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    quotes = db.query(Quotation).offset(skip).limit(limit).all()
    return quotes

@router.post("/", response_model=QuotationResponse)
def create_quotation(quote: QuotationCreate, db: Session = Depends(get_db)):
    # Check if a quote from the same supplier for the same product exists today
    today = datetime.datetime.utcnow().date()
    existing = db.query(Quotation).filter(
        Quotation.product_id == quote.product_id,
        Quotation.supplier_id == quote.supplier_id
    ).all()
    
    # Simple logic: we just add a new quote to keep history, but we can also update.
    # We will add a new one to keep track of price variations.
    new_quote = Quotation(**quote.model_dump())
    db.add(new_quote)
    db.commit()
    db.refresh(new_quote)
    return new_quote

@router.delete("/{quote_id}")
def delete_quotation(quote_id: int, db: Session = Depends(get_db)):
    quote = db.query(Quotation).filter(Quotation.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Cotação não encontrada")
    db.delete(quote)
    db.commit()
    return {"ok": True}
