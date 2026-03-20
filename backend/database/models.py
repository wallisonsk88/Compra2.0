from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    ean = Column(String, unique=True, index=True)
    category = Column(String)
    laboratory = Column(String)
    average_selling_price = Column(Float, nullable=True)
    
    quotes = relationship("Quotation", back_populates="product")

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    location = Column(String) # City/State
    contact = Column(String) # WhatsApp
    payment_terms = Column(String)
    delivery_time = Column(String) # em dias ou descrição

    quotes = relationship("Quotation", back_populates="supplier")

class Quotation(Base):
    __tablename__ = "quotations"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    price = Column(Float)
    date = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("Product", back_populates="quotes")
    supplier = relationship("Supplier", back_populates="quotes")
