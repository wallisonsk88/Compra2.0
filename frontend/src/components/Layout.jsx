import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, Truck, ShoppingCart, LogOut, Menu, X, FileText } from "lucide-react";

export default function Layout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/products", label: "Produtos", icon: Package },
    { path: "/suppliers", label: "Fornecedores", icon: Truck },
    { path: "/order-builder", label: "Nova Compra", icon: ShoppingCart },
    { path: "/reports", label: "Relatórios", icon: FileText },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Overlay mobile */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-slate-200 flex flex-col justify-between
        transform transition-transform duration-200 ease-in-out
        ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:static lg:translate-x-0
      `}>
        <div>
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
            <h1 className="text-xl font-bold text-primary flex items-center gap-2">
              <ShoppingCart className="w-6 h-6" /> MegaFarma
            </h1>
            <button onClick={() => setMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? "bg-primary text-white shadow-md shadow-primary/30" 
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200">
          <button className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 lg:h-16 bg-surface border-b border-slate-200 flex items-center px-4 lg:px-8 shadow-sm justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuOpen(true)} className="lg:hidden text-slate-600 hover:text-slate-900">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg lg:text-xl font-semibold text-slate-800 capitalize">
              {navItems.find(i => i.path === location.pathname)?.label || "MegaFarma"}
            </h2>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              U
            </div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">Farmácia Admin</span>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
