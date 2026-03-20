import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Package, Trash2, Edit, Upload, FileSpreadsheet, X, Check, ShoppingCart } from "lucide-react";
import { supabase, fetchAllRows } from "../lib/supabase";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const navigate = useNavigate();
  
  // Import
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  
  // Edição inline de preço
  const [editingPriceKey, setEditingPriceKey] = useState(null); // "productId-supplierId"
  const [editPriceValue, setEditPriceValue] = useState("");
  
  // Form state
  const [name, setName] = useState("");
  const [ean, setEan] = useState("");
  const [laboratory, setLaboratory] = useState("");
  const [category, setCategory] = useState("");
  const [avgPrice, setAvgPrice] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const [prodData, supData, quotData] = await Promise.all([
        fetchAllRows("products", "*", "name"),
        fetchAllRows("suppliers", "id, name", "name"),
        fetchAllRows("quotations", "id, product_id, supplier_id, price")
      ]);
      setProducts(prodData || []);
      setSuppliers(supData || []);
      setQuotations(quotData || []);
    } catch (error) {
      console.error("Erro ao buscar dados:", error.message);
    } finally {
      setLoading(false);
    }
  }

  // Mapa rápido de preços: chave "productId-supplierId" -> { id, price }
  const priceMap = useMemo(() => {
    const map = {};
    quotations.forEach(q => {
      map[`${q.product_id}-${q.supplier_id}`] = { id: q.id, price: q.price };
    });
    return map;
  }, [quotations]);

  const getPrice = useCallback((productId, supplierId) => {
    return priceMap[`${productId}-${supplierId}`] || null;
  }, [priceMap]);

  // === Edição inline de preço ===
  function startEditPrice(productId, supplierId, currentPrice) {
    setEditingPriceKey(`${productId}-${supplierId}`);
    setEditPriceValue(currentPrice ? currentPrice.toString() : "");
  }

  function cancelEditPrice() {
    setEditingPriceKey(null);
    setEditPriceValue("");
  }

  async function saveEditPrice(productId, supplierId) {
    const val = parseFloat(editPriceValue);
    if (!editPriceValue || isNaN(val) || val <= 0) { alert("Preço inválido."); return; }
    try {
      const existing = getPrice(productId, supplierId);
      if (existing) {
        const { error } = await supabase.from("quotations").update({ price: val, created_at: new Date().toISOString() }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quotations").insert([{ product_id: productId, supplier_id: supplierId, price: val }]);
        if (error) throw error;
      }
      cancelEditPrice();
      // Refresh quotations
      const { data } = await supabase.from("quotations").select("id, product_id, supplier_id, price");
      setQuotations(data || []);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar preço.");
    }
  }

  // === Product CRUD ===
  function handleEditClick(product) {
    setShowForm(true);
    setShowImport(false);
    setEditingId(product.id);
    setName(product.name || "");
    setEan(product.ean || "");
    setLaboratory(product.laboratory || "");
    setCategory(product.category || "");
    setAvgPrice(product.average_selling_price || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setName(""); setEan(""); setLaboratory(""); setCategory(""); setAvgPrice("");
  }

  async function handleAddOrUpdateProduct(e) {
    e.preventDefault();
    try {
      const payload = { 
        name, ean: ean || null, laboratory: laboratory || null, 
        category: category || null, average_selling_price: avgPrice ? parseFloat(avgPrice) : null 
      };
      if (editingId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editingId);
        if (error) { alert("Erro ao editar produto."); throw error; }
        setProducts(products.map(p => p.id === editingId ? { ...p, ...payload } : p));
      } else {
        const { data, error } = await supabase.from("products").insert([payload]).select();
        if (error) { alert("Erro ao adicionar produto."); throw error; }
        setProducts([...products, data[0]]);
      }
      handleCancel();
    } catch (error) { console.error(error); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Deseja realmente excluir este produto?")) return;
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      setProducts(products.filter(p => p.id !== id));
    } catch (error) { console.error(error); alert("Erro ao excluir produto."); }
  }

  // === IMPORTAÇÃO ===
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv' || ext === 'txt') {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (results) => setImportPreview(mapColumnsToProducts(results.data)),
        error: () => alert("Erro ao ler o arquivo CSV.")
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const workbook = XLSX.read(evt.target.result, { type: 'binary' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
        setImportPreview(mapColumnsToProducts(jsonData));
      };
      reader.readAsBinaryString(file);
    } else {
      alert("Formato não suportado. Use .csv, .xlsx ou .xls");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function mapColumnsToProducts(rows) {
    return rows.map(row => {
      const keys = Object.keys(row);
      const findCol = (patterns) => {
        for (const p of patterns) {
          const found = keys.find(k => k.toLowerCase().trim().includes(p));
          if (found) return row[found];
        }
        return "";
      };
      return {
        name: findCol(["nome", "name", "produto", "descri", "product"]) || row[keys[0]] || "",
        ean: findCol(["ean", "barras", "codigo", "code", "gtin", "barra"]) || "",
        laboratory: findCol(["lab", "fabricante", "marca"]) || "",
        category: findCol(["categ", "grupo", "class"]) || "",
        average_selling_price: parseFloat(findCol(["preco", "preço", "venda", "price", "valor"])) || null
      };
    }).filter(r => r.name && r.name.trim().length > 0);
  }

  async function handleConfirmImport() {
    if (importPreview.length === 0) return;
    setImporting(true);
    try {
      const payload = importPreview.map(p => ({
        name: p.name.trim(), ean: p.ean ? String(p.ean).trim() : null,
        laboratory: p.laboratory ? p.laboratory.trim() : null,
        category: p.category ? p.category.trim() : null,
        average_selling_price: p.average_selling_price || null
      }));
      const eanMap = new Map();
      payload.forEach(p => { if (p.ean) eanMap.set(p.ean, p); });
      const withEan = Array.from(eanMap.values());
      const withoutEan = payload.filter(p => !p.ean);
      let totalProcessed = 0;
      const batchSize = 500;
      for (let i = 0; i < withEan.length; i += batchSize) {
        const batch = withEan.slice(i, i + batchSize);
        const { error } = await supabase.from("products").upsert(batch, { onConflict: "ean", ignoreDuplicates: false });
        if (error) { alert(`Erro: ${error.message}. ${totalProcessed} já foram salvos.`); break; }
        totalProcessed += batch.length;
      }
      for (let i = 0; i < withoutEan.length; i += batchSize) {
        const batch = withoutEan.slice(i, i + batchSize);
        const { error } = await supabase.from("products").insert(batch);
        if (error) { alert(`Erro: ${error.message}`); break; }
        totalProcessed += batch.length;
      }
      alert(`${totalProcessed} produtos importados/atualizados!`);
      setImportPreview([]); setShowImport(false);
      fetchAll();
    } catch (err) { console.error(err); alert("Erro ao processar importação."); }
    finally { setImporting(false); }
  }

  // Filtro de busca (memoizado)
  const filteredProducts = useMemo(() => {
    if (!searchFilter) return products;
    const s = searchFilter.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(s) || (p.ean && p.ean.includes(s)) || (p.laboratory && p.laboratory.toLowerCase().includes(s))
    );
  }, [products, searchFilter]);

  // Paginação
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);

  // Reset paginação quando filtro muda
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [searchFilter]);

  // Melhor preço por produto (pré-calculado, não recalcula por linha)
  const bestPriceMap = useMemo(() => {
    const map = {};
    quotations.forEach(q => {
      const key = q.product_id;
      if (!map[key] || q.price < map[key].price) {
        map[key] = { supplierId: q.supplier_id, price: q.price };
      }
    });
    return map;
  }, [quotations]);

  // === Seleção / Checkbox ===
  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  }

  function sendToOrder() {
    const selected = products.filter(p => selectedIds.has(p.id));
    localStorage.setItem('smartpharma_cart', JSON.stringify(selected));
    navigate('/order-builder');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Produtos</h2>
          <p className="text-slate-500 text-sm">Portfólio completo com preços de cada fornecedor. Clique no valor para editar.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowImport(!showImport); setShowForm(false); setImportPreview([]); }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 flex items-center gap-2 rounded-xl transition-colors font-medium text-sm">
            <Upload className="w-4 h-4" /> Importar
          </button>
          <button onClick={showForm ? handleCancel : () => { setShowForm(true); setShowImport(false); }}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 flex items-center gap-2 rounded-xl transition-colors shadow-sm font-medium">
            <Plus className="w-5 h-5" /> {showForm ? "Cancelar" : "Adicionar"}
          </button>
        </div>
      </div>

      {/* Importar Planilha */}
      {showImport && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500" /> Importar Produtos em Massa
            </h3>
            <button onClick={() => { setShowImport(false); setImportPreview([]); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          {importPreview.length === 0 ? (
            <div>
              <p className="text-sm text-slate-500 mb-4">
                Selecione um arquivo <strong>.csv</strong> ou <strong>.xlsx</strong>. Colunas reconhecidas: <code className="bg-slate-100 px-1 rounded">nome</code>, <code className="bg-slate-100 px-1 rounded">ean</code>, <code className="bg-slate-100 px-1 rounded">laboratório</code>, <code className="bg-slate-100 px-1 rounded">categoria</code>.
              </p>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                <Upload className="w-10 h-10 text-slate-400 mb-3" />
                <span className="text-sm font-medium text-slate-600">Clique para selecionar arquivo</span>
                <span className="text-xs text-slate-400 mt-1">CSV, XLS ou XLSX</span>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.txt" onChange={handleFileSelect} className="hidden" />
              </label>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-600"><strong className="text-emerald-600">{importPreview.length}</strong> produtos detectados.</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setImportPreview([])} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1 rounded-lg border border-slate-200">Cancelar</button>
                  <button onClick={handleConfirmImport} disabled={importing}
                    className="text-sm bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
                    {importing ? "Importando..." : `Confirmar ${importPreview.length}`}
                  </button>
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 sticky top-0"><tr className="text-slate-500 text-xs uppercase">
                    <th className="px-3 py-2">#</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">EAN</th><th className="px-3 py-2">Lab</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {importPreview.slice(0, 50).map((p, idx) => (
                      <tr key={idx}><td className="px-3 py-2 text-slate-400">{idx+1}</td><td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-xs font-mono">{p.ean||"-"}</td><td className="px-3 py-2 text-slate-500">{p.laboratory||"-"}</td></tr>
                    ))}
                  </tbody>
                </table>
                {importPreview.length > 50 && <p className="text-center text-xs text-slate-400 py-2">... e mais {importPreview.length - 50}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Formulário Manual */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-semibold text-lg mb-4 text-slate-800">{editingId ? "Editar Produto" : "Novo Produto"}</h3>
          <form onSubmit={handleAddOrUpdateProduct} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" placeholder="Nome do Produto *" value={name} onChange={e => setName(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white" />
            <input type="text" placeholder="Código de Barras (EAN)" value={ean} onChange={e => setEan(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <input type="text" placeholder="Laboratório" value={laboratory} onChange={e => setLaboratory(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <input type="text" placeholder="Categoria" value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <input type="number" step="0.01" placeholder="Preço Médio Venda (R$)" value={avgPrice} onChange={e => setAvgPrice(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="flex items-center">
               <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg px-4 py-2 transition-colors">
                 {editingId ? "Salvar Alterações" : "Salvar Produto"}
               </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela de Produtos com preços por fornecedor */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Pesquisar por nome, EAN ou laboratório..."
              value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <span className="text-xs text-slate-400 bg-slate-200/70 px-2 py-1 rounded-full shrink-0">{filteredProducts.length} produtos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold">
                <th className="px-2 py-3 w-10 text-center">
                  <input type="checkbox" checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                    onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/50 cursor-pointer" />
                </th>
                <th className="px-4 py-3 sticky left-0 bg-slate-50 z-10">Produto</th>
                {suppliers.map(s => (
                  <th key={s.id} className="px-3 py-3 text-center whitespace-nowrap">
                    <span className="text-primary font-bold normal-case text-xs">{s.name}</span>
                  </th>
                ))}
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={3 + suppliers.length} className="p-8 text-center text-slate-500">Carregando...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={3 + suppliers.length} className="p-8 text-center text-slate-500">
                  {searchFilter ? "Nenhum resultado." : "Nenhum produto cadastrado."}
                </td></tr>
              ) : (
                visibleProducts.map((product) => {
                  const best = bestPriceMap[product.id];
                  const bestSupId = best ? best.supplierId : null;
                  return (
                    <tr key={product.id} className={`transition-colors ${selectedIds.has(product.id) ? 'bg-primary/5' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-2 py-3 text-center">
                        <input type="checkbox" checked={selectedIds.has(product.id)} onChange={() => toggleSelect(product.id)}
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/50 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3 sticky left-0 bg-white">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-sm truncate max-w-[200px]">{product.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {product.category && <p className="text-[10px] text-slate-400 truncate">{product.category}</p>}
                              {product.last_purchase_price && (
                                <p className="text-[10px] text-amber-600 truncate bg-amber-50 px-1.5 rounded font-medium" 
                                   title={`Última compra em ${product.last_purchase_date ? new Date(product.last_purchase_date).toLocaleDateString('pt-BR') : 'data desconhecida'}`}>
                                  Último pedido: {product.last_supplier || '?'} (R$ {Number(product.last_purchase_price).toFixed(2)})
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {suppliers.map(s => {
                        const priceData = getPrice(product.id, s.id);
                        const isBest = bestSupId === s.id && priceData;
                        const cellKey = `${product.id}-${s.id}`;
                        const isEditing = editingPriceKey === cellKey;

                        return (
                          <td key={s.id} className="px-2 py-2 text-center">
                            {isEditing ? (
                              <div className="flex items-center gap-1 justify-center">
                                <input type="number" step="0.01" min="0" value={editPriceValue}
                                  onChange={e => setEditPriceValue(e.target.value)} autoFocus
                                  onKeyDown={e => { if(e.key==='Enter') saveEditPrice(product.id, s.id); if(e.key==='Escape') cancelEditPrice(); }}
                                  className="w-20 px-1.5 py-1 border border-amber-300 rounded text-center text-sm font-bold bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                />
                                <button onClick={() => saveEditPrice(product.id, s.id)} className="text-emerald-500"><Check className="w-3.5 h-3.5" /></button>
                                <button onClick={cancelEditPrice} className="text-slate-400"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : priceData ? (
                              <button onClick={() => startEditPrice(product.id, s.id, priceData.price)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all hover:scale-105 ${
                                  isBest 
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm' 
                                    : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                                }`}
                                title="Clique para editar">
                                {priceData.price.toFixed(2)}
                              </button>
                            ) : (
                              <button onClick={() => startEditPrice(product.id, s.id, null)}
                                className="text-slate-300 hover:text-primary text-xs cursor-pointer hover:bg-primary/5 px-2 py-1 rounded transition-colors"
                                title="Adicionar preço">
                                —
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center gap-2 justify-center">
                           <button onClick={() => handleEditClick(product)} className="text-amber-500 hover:text-amber-600" title="Editar"><Edit className="w-4 h-4" /></button>
                           <button onClick={() => handleDelete(product.id)} className="text-slate-400 hover:text-red-500" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Carregar mais */}
        {visibleCount < filteredProducts.length && (
          <div className="p-3 text-center border-t border-slate-100">
            <button onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
              className="text-sm text-primary font-semibold hover:underline">
              Carregar mais ({filteredProducts.length - visibleCount} restantes)
            </button>
          </div>
        )}
      </div>

      {/* Barra flutuante de seleção */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-4 right-4 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:w-auto bg-slate-900 text-white px-4 lg:px-6 py-3 rounded-2xl shadow-2xl flex items-center justify-between lg:justify-start gap-3 lg:gap-4 z-50">
          <span className="text-sm font-medium">
            <strong className="text-emerald-400">{selectedIds.size}</strong> selecionado{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-white text-xs">Limpar</button>
            <button onClick={sendToOrder}
              className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm transition-all active:scale-95 shadow-lg shadow-emerald-500/30">
              <ShoppingCart className="w-4 h-4" /> Comprar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
