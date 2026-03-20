from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# --- Pydantic: Users ---
class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# --- Pydantic: Products ---
class ProductBase(BaseModel):
    name: str
    ean: str
    category: Optional[str] = None
    laboratory: str
    average_selling_price: Optional[float] = None

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: int

    class Config:
        from_attributes = True

# --- Pydantic: Suppliers ---
class SupplierBase(BaseModel):
    name: str
    location: Optional[str] = None
    contact: Optional[str] = None
    payment_terms: Optional[str] = None
    delivery_time: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierResponse(SupplierBase):
    id: int

    class Config:
        from_attributes = True

# --- Pydantic: Quotations ---
class QuotationBase(BaseModel):
    product_id: int
    supplier_id: int
    price: float

class QuotationCreate(QuotationBase):
    pass

class QuotationResponse(QuotationBase):
    id: int
    date: datetime
    product: Optional[ProductResponse] = None
    supplier: Optional[SupplierResponse] = None

    class Config:
        from_attributes = True
