import { useState, useEffect, useRef } from "react";
import { Check, Calculator, Trash2, Search, RefreshCw, Edit, X, Package } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Quotes() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [allQuotes, setAllQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [price, setPrice] = useState("");
  
  const [tableSearch, setTableSearch] = useState("");
  const [editingKey, setEditingKey] = useState(null); // "quoteId"
  const [editPrice, setEditPrice] = useState("");
  
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchData();
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [prodRes, supRes, quotesRes] = await Promise.all([
        supabase.from("products").select("id, name, ean").order("name"),
        supabase.from("suppliers").select("id, name").order("name"),
        supabase.from("quotations_view").select("*").order("product_name")
      ]);
      if (prodRes.error) throw prodRes.error;
      if (supRes.error) throw supRes.error;
      if (quotesRes.error) throw quotesRes.error;
      setProducts(prodRes.data || []);
      setSuppliers(supRes.data || []);
      setAllQuotes(quotesRes.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  // --- Inserção / Atualização de preço ---
  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !selectedSupplier || !price) {
      alert("Selecione um produto, um fornecedor e informe o preço.");
      return;
    }
    try {
      const { data: existing } = await supabase
        .from("quotations").select("id")
        .eq("product_id", parseInt(selectedProduct))
        .eq("supplier_id", parseInt(selectedSupplier))
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("quotations")
           .update({ price: parseFloat(price), created_at: new Date().toISOString() })
           .eq("id", existing.id);
        if (error) throw error;
        alert("Preço atualizado!");
      } else {
        const { error } = await supabase.from("quotations").insert([{
            product_id: parseInt(selectedProduct),
            supplier_id: parseInt(selectedSupplier),
            price: parseFloat(price)
        }]);
        if (error) throw error;
        alert("Preço registrado!");
      }
      setPrice(""); setSelectedProduct(""); setSearchQuery("");
      fetchData(); 
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar preço.");
    }
  };

  // --- Edição inline ---
  const startEdit = (quoteId, currentPrice) => {
    setEditingKey(quoteId);
    setEditPrice(currentPrice.toString());
  };
  const cancelEdit = () => { setEditingKey(null); setEditPrice(""); };
  const saveEdit = async (id) => {
    if (!editPrice || parseFloat(editPrice) <= 0) return alert("Preço inválido.");
    try {
      const { error } = await supabase.from("quotations")
        .update({ price: parseFloat(editPrice), created_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      cancelEdit();
      fetchData();
    } catch (err) { console.error(err); alert("Erro ao atualizar."); }
  };

  // --- Exclusão ---
  const handleDelete = async (id) => {
    if (!window.confirm("Remover este preço?")) return;
    try {
      await supabase.from("quotations").delete().eq("id", id);
      fetchData();
    } catch (err) { console.error(err); }
  };

  // --- Agrupamento: juntar cotações por produto ---
  const groupedByProduct = {};
  allQuotes.forEach(q => {
    if (!groupedByProduct[q.product_id]) {
      groupedByProduct[q.product_id] = {
        product_id: q.product_id,
        product_name: q.product_name,
        product_ean: q.product_ean,
        suppliers: []
      };
    }
    groupedByProduct[q.product_id].suppliers.push({
      quote_id: q.id,
      supplier_id: q.supplier_id,
      supplier_name: q.supplier_name,
      price: q.price,
      updated_at: q.created_at
    });
  });

  const productRows = Object.values(groupedByProduct).filter(row => {
    if (!tableSearch) return true;
    const s = tableSearch.toLowerCase();
    return row.product_name.toLowerCase().includes(s) || 
           (row.product_ean && row.product_ean.includes(s)) ||
           row.suppliers.some(sup => sup.supplier_name.toLowerCase().includes(s));
  });

  // Para saber o menor preço de cada produto (destaque visual)
  function getMinPrice(sups) {
    if (sups.length === 0) return null;
    return sups.reduce((min, s) => s.price < min.price ? s : min, sups[0]);
  }

  // --- Seletor de produto (busca) ---
  const filteredProducts = products.filter(p => {
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.ean && p.ean.includes(q));
  });
  function selectProduct(p) {
    setSelectedProduct(p.id);
    setSearchQuery(`${p.name} ${p.ean ? `(${p.ean})` : ""}`);
    setShowDropdown(false);
  }

  // Todas os nomes de fornecedores existentes (para header dinâmico)
  const allSupplierNames = suppliers.map(s => s.name);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tabela de Preços (Catálogo)</h2>
          <p className="text-slate-500 text-sm">Atualize os preços dos distribuidores. Cada produto mostra todos os fornecedores na mesma linha.</p>
        </div>
      </div>

      {/* Formulário de inserção — Destaque */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-lg p-8 text-white">
        <h3 className="text-lg font-bold mb-1 flex items-center gap-2">📋 Registrar Preço de Fornecedor</h3>
        <p className="text-slate-400 text-sm mb-6">Selecione o fornecedor, busque o produto e informe o preço acordado.</p>
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Fornecedor */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 block">Fornecedor</label>
              <select 
                value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}
                className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-xl text-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-400/60 placeholder-slate-400"
              >
                <option value="" disabled className="text-slate-800">Selecione o distribuidor...</option>
                {suppliers.map(s => <option key={s.id} value={s.id} className="text-slate-800">{s.name}</option>)}
              </select>
            </div>

            {/* Produto */}
            <div className="space-y-2 relative" ref={dropdownRef}>
              <label className="text-sm font-semibold text-slate-300 block">Produto</label>
              <input 
                 type="text" placeholder="Digite o nome ou código de barras..."
                 value={searchQuery}
                 onChange={e => { setSearchQuery(e.target.value); setSelectedProduct(""); setShowDropdown(true); }}
                 onFocus={() => setShowDropdown(true)}
                 className={`w-full px-5 py-4 border rounded-xl text-base focus:outline-none focus:ring-2 ${selectedProduct ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100 focus:ring-emerald-400/60' : 'bg-white/10 border-white/20 text-white focus:ring-emerald-400/60 placeholder-slate-400'}`}
              />
              {showDropdown && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 shadow-2xl rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                     <li className="p-4 text-sm text-slate-500 text-center">Nenhum produto encontrado.</li>
                  ) : filteredProducts.map(p => (
                      <li key={p.id} onClick={() => selectProduct(p)} className="p-3 hover:bg-slate-50 cursor-pointer">
                        <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
                        {p.ean && <p className="text-xs text-slate-500 font-mono">{p.ean}</p>}
                      </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Preço */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 block">Preço Acordado</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">R$</span>
                <input type="number" step="0.01" min="0" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)}
                  className="w-full pl-14 pr-5 py-4 bg-white/10 border border-white/20 rounded-xl text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400/60 placeholder-slate-500" />
              </div>
            </div>
            
            {/* Botão */}
            <div className="flex items-end">
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/30 text-base">
                <RefreshCw className="w-5 h-5" /> Salvar Preço
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Tabela Agrupada */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-slate-400"/>
            <h3 className="font-semibold text-sm text-slate-700">Catálogo Completo</h3>
            <span className="text-xs text-slate-400 bg-slate-200/70 px-2 py-0.5 rounded-full">{productRows.length} produtos</span>
          </div>
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" placeholder="Pesquisar produto ou fornecedor..."
              value={tableSearch} onChange={e => setTableSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando catálogo...</div>
        ) : productRows.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {tableSearch ? "Nenhum resultado para a pesquisa." : "Nenhum preço cadastrado ainda. Use o formulário acima."}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {productRows.map(row => {
              const best = getMinPrice(row.suppliers);
              return (
                <div key={row.product_id} className="p-4 hover:bg-slate-50/50 transition-colors">
                  {/* Produto Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 text-sm truncate">{row.product_name}</h4>
                      {row.product_ean && <p className="text-xs text-slate-400 font-mono">{row.product_ean}</p>}
                    </div>
                    {best && (
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Melhor preço</p>
                        <p className="font-bold text-emerald-600 text-sm">R$ {best.price.toFixed(2)}</p>
                        <p className="text-[10px] text-emerald-500">{best.supplier_name}</p>
                      </div>
                    )}
                  </div>

                  {/* Fornecedores em chips inline */}
                  <div className="flex flex-wrap gap-2 ml-12">
                    {row.suppliers
                      .sort((a, b) => a.price - b.price)
                      .map(sup => {
                        const isBest = best && sup.quote_id === best.quote_id;
                        const isEditing = editingKey === sup.quote_id;

                        return (
                          <div key={sup.quote_id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                            isEditing 
                              ? 'border-amber-300 bg-amber-50' 
                              : isBest 
                                ? 'border-emerald-200 bg-emerald-50' 
                                : 'border-slate-200 bg-slate-50'
                          }`}>
                            <span className={`font-medium text-xs ${isBest ? 'text-emerald-700' : 'text-slate-600'}`}>
                              {sup.supplier_name}
                            </span>
                            <span className="text-slate-300">|</span>

                            {isEditing ? (
                              <>
                                <input
                                  type="number" step="0.01" min="0" value={editPrice}
                                  onChange={e => setEditPrice(e.target.value)} autoFocus
                                  onKeyDown={e => { if(e.key==='Enter') saveEdit(sup.quote_id); if(e.key==='Escape') cancelEdit(); }}
                                  className="w-20 px-1.5 py-0.5 border border-amber-300 rounded text-right font-bold text-sm bg-white focus:outline-none"
                                />
                                <button onClick={() => saveEdit(sup.quote_id)} className="text-emerald-500 hover:text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
                                <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                              </>
                            ) : (
                              <>
                                <span className={`font-bold text-xs ${isBest ? 'text-emerald-700' : 'text-slate-700'}`}>
                                  R$ {sup.price.toFixed(2)}
                                </span>
                                <button onClick={() => startEdit(sup.quote_id, sup.price)} className="text-slate-400 hover:text-amber-500 ml-1" title="Editar">
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button onClick={() => handleDelete(sup.quote_id)} className="text-slate-300 hover:text-red-500" title="Remover">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
