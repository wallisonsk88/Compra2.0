import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# URL do banco de dados (Fallback para SQLite se nãotiver PostgreSQL localmente)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./smartpharma.db")

# Se for SQLite, precisamos do parâmetro check_same_thread
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependência do DB (Injeção em cada request)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
