from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database.database import engine, Base
from routers import products, suppliers, quotes, orders, auth

# Cria as tabelas (idealmente usar Alembic em prod)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SmartPharma API",
    description="API para gestão inteligente de compras de farmácia",
    version="1.0.0"
)

# Configurar CORS (permitir frontend local)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Em prod, restringir para domínio do frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir rotas
app.include_router(auth.router, prefix="/api/auth", tags=["Autenticação"])
app.include_router(products.router, prefix="/api/products", tags=["Produtos"])
app.include_router(suppliers.router, prefix="/api/suppliers", tags=["Fornecedores"])
app.include_router(quotes.router, prefix="/api/quotes", tags=["Cotações"])
app.include_router(orders.router, prefix="/api/orders", tags=["Pedidos Intelingentes"])

@app.get("/")
def read_root():
    return {"message": "Bem-vindo à API SmartPharma"}
