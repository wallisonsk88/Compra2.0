import { useState, useEffect, useRef } from "react";
import { Sparkles, ShoppingCart, MessageCircle, AlertTriangle, Plus, Search, Trash2, ListChecks, CheckCircle, Printer, X } from "lucide-react";
import { supabase, fetchAllRows } from "../lib/supabase";

export default function OrderBuilder() {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Carrinho persistido no banco
  const [shoppingList, setShoppingList] = useState([]);
  
  // Resultados da inteligência de pedidos
  const [orderPlan, setOrderPlan] = useState({ summary: { total_cost: 0, total_savings: 0 }, orders: {} });
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  // Quantidades por item: { "supplierName-productName": qty }
  const [quantities, setQuantities] = useState({});
  const [qtyModalSupplier, setQtyModalSupplier] = useState(null); // supplier name para modal aberto

  useEffect(() => {
    fetchBaseProducts();

    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (shoppingList.length > 0) {
       generateOrderPlan();
    } else {
       setOrderPlan({ summary: { total_cost: 0, total_savings: 0 }, orders: {} });
    }
  }, [shoppingList]);

  async function fetchBaseProducts() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('products').select('*').order('name').limit(100);
      if (error) throw error;
      setProducts(data || []);

      // Carregar itens que estão no carrinho global (in_cart = true)
      const { data: cartData, error: cartErr } = await supabase.from('products').select('*').eq('in_cart', true);
      if (!cartErr && cartData) {
        setShoppingList(cartData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function generateOrderPlan() {
    try {
      setComputing(true);
      
      const productIds = shoppingList.map(item => item.id);
      
      // Buscar APENAS OS PREÇOS do carrinho selecionado
      const { data: quotes, error } = await supabase
        .from('quotations_view')
        .select('*')
        .in('product_id', productIds)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (!quotes || quotes.length === 0) {
        setOrderPlan({ summary: { total_cost: 0, total_savings: 0 }, orders: {} });
        return;
      }

      const productQuotes = {};
      quotes.forEach(q => {
        if (!productQuotes[q.product_id]) productQuotes[q.product_id] = [];
        productQuotes[q.product_id].push(q);
      });

      let totalCost = 0;
      let totalSavings = 0;
      const optimizedOrders = {};

      shoppingList.forEach(item => {
        const prodQuotesList = productQuotes[item.id];
        
        // Se este produto selecionado não tem preço salvo em nenhum fornecedor
        if (!prodQuotesList || prodQuotesList.length === 0) {
            if (!optimizedOrders["Sem Preço Tabela"]) {
                optimizedOrders["Sem Preço Tabela"] = { supplier_total: 0, items: [] };
            }
            optimizedOrders["Sem Preço Tabela"].items.push({
               productId: item.id, product: item.name, price: 0, savings: 0, note: "Sem fornecedor"
            });
            return;
        }

        // Acha o melhor valor
        const bestQuote = prodQuotesList.reduce((min, q) => (q.price < min.price ? q : min), prodQuotesList[0]);
        
        // Calcular economia em relação aos outros
        const otherQuotes = prodQuotesList.filter(q => q.id !== bestQuote.id);
        let savings = 0;
        if (otherQuotes.length > 0) {
           const avgOthers = otherQuotes.reduce((acc, curr) => acc + curr.price, 0) / otherQuotes.length;
           savings = avgOthers - bestQuote.price;
           if(savings < 0) savings = 0;
        }

        // Add to supplier order
        const supplierName = bestQuote.supplier_name;
        if (!optimizedOrders[supplierName]) optimizedOrders[supplierName] = { supplier_total: 0, items: [] };
        
        optimizedOrders[supplierName].items.push({
          productId: item.id,
          product: bestQuote.product_name,
          price: bestQuote.price,
          savings: savings,
          last_purchase_price: item.last_purchase_price,
          last_supplier: item.last_supplier,
          last_purchase_date: item.last_purchase_date
        });
        
        optimizedOrders[supplierName].supplier_total += bestQuote.price;
        totalCost += bestQuote.price;
        totalSavings += savings;
      });

      setOrderPlan({
        summary: { total_cost: totalCost, total_savings: totalSavings },
        orders: optimizedOrders
      });

    } catch (error) {
      console.error("Erro ao computar:", error);
    } finally {
      setComputing(false);
    }
  }

  const filteredProducts = products.filter(p => !shoppingList.some(item => item.id === p.id) && (
    (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
    (p.ean && p.ean.includes(searchQuery))
  )).slice(0, 50);

  async function addToCart(p) {
    setShoppingList([...shoppingList, p]);
    setSearchQuery("");
    setShowDropdown(false);
    try {
      await supabase.from('products').update({ in_cart: true }).eq('id', p.id);
    } catch(e) {}
  }

  async function removeFromCart(id) {
    setShoppingList(shoppingList.filter(i => i.id !== id));
    try {
      await supabase.from('products').update({ in_cart: false }).eq('id', id);
    } catch(e) {}
  }

  function getQty(supplier, product) {
    return quantities[`${supplier}||${product}`] || 1;
  }

  function setQty(supplier, product, val) {
    const v = Math.max(1, parseInt(val) || 1);
    setQuantities(prev => ({ ...prev, [`${supplier}||${product}`]: v }));
  }

  function getSupplierTotal(supplier, data) {
    if (!data.items) return 0;
    return data.items.reduce((sum, item) => {
      const q = getQty(supplier, item.product);
      return sum + (item.price > 0 ? item.price * q : 0);
    }, 0);
  }

  function printSupplierOrder(supplier, data) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    let rows = '';
    let grandTotal = 0;
    (data.items || []).forEach((item, i) => {
      const qty = getQty(supplier, item.product);
      const sub = item.price > 0 ? item.price * qty : 0;
      grandTotal += sub;
      rows += `<tr style="background:${i%2===0?'#fff':'#f8fafc'}">
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${item.product}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${item.price > 0 ? 'R$ '+Number(item.price).toFixed(2) : '-'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700">${sub > 0 ? 'R$ '+sub.toFixed(2) : '-'}</td>
      </tr>`;
    });

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido - ${supplier}</title>
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:30px;color:#1e293b}
        table{width:100%;border-collapse:collapse}
        @media print{body{padding:15px}}
      </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0ea5e9;padding-bottom:14px;margin-bottom:20px">
        <div>
          <h1 style="margin:0;font-size:22px;color:#0ea5e9">🛒 MegaFarma</h1>
          <p style="margin:4px 0 0;color:#64748b;font-size:12px">Pedido de Compra — ${dateStr}</p>
        </div>
        <div style="text-align:right">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600">Fornecedor</p>
          <p style="margin:2px 0 0;font-size:18px;font-weight:800;color:#1e293b">${supplier}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr style="background:#f1f5f9">
            <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #cbd5e1;font-size:11px;text-transform:uppercase;color:#64748b">Produto</th>
            <th style="text-align:center;padding:8px 12px;border-bottom:2px solid #cbd5e1;font-size:11px;text-transform:uppercase;color:#64748b">Qtd</th>
            <th style="text-align:right;padding:8px 12px;border-bottom:2px solid #cbd5e1;font-size:11px;text-transform:uppercase;color:#64748b">Unit.</th>
            <th style="text-align:right;padding:8px 12px;border-bottom:2px solid #cbd5e1;font-size:11px;text-transform:uppercase;color:#64748b">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="border-top:2px solid #0ea5e9">
            <td colspan="3" style="padding:10px 12px;font-weight:800;font-size:14px">TOTAL (${data.items?.length || 0} itens)</td>
            <td style="padding:10px 12px;text-align:right;font-weight:800;font-size:16px;color:#0ea5e9">R$ ${grandTotal.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top:40px;border-top:1px dashed #cbd5e1;padding-top:16px;display:flex;justify-content:space-between">
        <div><p style="margin:0;font-size:10px;color:#94a3b8">Assinatura do Responsável</p><div style="margin-top:30px;border-top:1px solid #1e293b;width:200px"></div></div>
        <div style="text-align:right"><p style="margin:0;font-size:10px;color:#94a3b8">Data de Entrega</p><div style="margin-top:30px;border-top:1px solid #1e293b;width:200px"></div></div>
      </div>

      <p style="text-align:center;margin-top:30px;color:#94a3b8;font-size:10px">MegaFarma — Sistema de Compras Inteligentes</p>
    </body></html>`;

    const w = window.open('', '_blank', 'width=800,height=600');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  }

  async function finishOrder() {
    if (!window.confirm('Concluir este pedido e imprimir a lista de compras?')) return;

    // Salvar no histórico
    try {
      const { error } = await supabase.from('orders').insert([{
        total_cost: orderPlan.summary.total_cost,
        total_savings: orderPlan.summary.total_savings,
        items_count: shoppingList.length,
        details: orderPlan.orders
      }]);
      if (error) console.error('Erro ao salvar pedido:', error);

      // Atualizar o histórico do produto individual
      const productUpdates = [];
      const nowString = new Date().toISOString();
      Object.entries(orderPlan.orders).forEach(([supplierName, data]) => {
        if (supplierName === 'Sem Preço Tabela') return;
        (data.items || []).forEach(item => {
          if (item.productId && item.price > 0) {
            productUpdates.push(
              supabase.from('products').update({
                last_purchase_price: item.price,
                last_supplier: supplierName,
                last_purchase_date: nowString
              }).eq('id', item.productId)
            );
          }
        });
      });
      if (productUpdates.length > 0) {
        await Promise.all(productUpdates);
      }
    } catch(e) { console.error(e); }

    // Gerar HTML de impressão
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    let supplierBlocks = '';

    Object.entries(orderPlan.orders).forEach(([supplier, data]) => {
      const isSem = supplier === 'Sem Preço Tabela';
      let rows = '';
      (data.items || []).forEach(item => {
        rows += `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${item.product}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600">${item.price > 0 ? 'R$ '+Number(item.price).toFixed(2) : 'Sem cotação'}</td>
        </tr>`;
      });
      supplierBlocks += `
        <div style="margin-bottom:20px;border:1px solid ${isSem?'#fecaca':'#e2e8f0'};border-radius:8px;overflow:hidden">
          <div style="background:${isSem?'#fef2f2':'#f8fafc'};padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ${isSem?'#fecaca':'#e2e8f0'}">
            <strong style="color:${isSem?'#dc2626':'#0ea5e9'};font-size:14px">${supplier}</strong>
            ${!isSem && data.supplier_total > 0 ? '<span style="font-weight:700;font-size:14px">R$ '+Number(data.supplier_total).toFixed(2)+'</span>' : ''}
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">${rows}</table>
        </div>`;
    });

    const printHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido MegaFarma</title>
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:30px;color:#1e293b}
        @media print{body{padding:15px}}
      </style></head><body>
      <div style="text-align:center;margin-bottom:24px;border-bottom:2px solid #0ea5e9;padding-bottom:16px">
        <h1 style="margin:0;font-size:24px;color:#0ea5e9">🛒 MegaFarma</h1>
        <p style="margin:4px 0 0;color:#64748b;font-size:13px">Lista de Compras — ${dateStr}</p>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;gap:16px">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;flex:1;text-align:center">
          <div style="font-size:11px;color:#16a34a;font-weight:600">CUSTO TOTAL</div>
          <div style="font-size:20px;font-weight:800;color:#15803d">R$ ${orderPlan.summary.total_cost.toFixed(2)}</div>
        </div>
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px 16px;flex:1;text-align:center">
          <div style="font-size:11px;color:#0284c7;font-weight:600">ECONOMIA</div>
          <div style="font-size:20px;font-weight:800;color:#0369a1">R$ ${orderPlan.summary.total_savings.toFixed(2)}</div>
        </div>
        <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:12px 16px;flex:1;text-align:center">
          <div style="font-size:11px;color:#7c3aed;font-weight:600">ITENS</div>
          <div style="font-size:20px;font-weight:800;color:#6d28d9">${shoppingList.length}</div>
        </div>
      </div>
      ${supplierBlocks}
      <div style="margin-top:24px;text-align:center;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;padding-top:12px">
        MegaFarma — Sistema de Compras Inteligentes
      </div>
    </body></html>`;

    const printWin = window.open('', '_blank', 'width=800,height=600');
    printWin.document.write(printHTML);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 400);

    const ids = shoppingList.map(i => i.id);
    setShoppingList([]);
    try {
      await supabase.from('products').update({ in_cart: false }).in('id', ids);
    } catch(e) {}
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Iniciando motor de recomendações...</div>;

  const supplierCount = Object.keys(orderPlan.orders).length;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Nova Compra <Sparkles className="w-5 h-5 text-amber-500" />
          </h2>
          <p className="text-slate-500 text-sm">Selecione o que falta na prateleira. A IA divide os pedidos pelos melhores preços salvos.</p>
        </div>
      </div>

      {/* Busca de produto inline */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="relative max-w-md" ref={dropdownRef}>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" placeholder="Buscar produto para adicionar..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
          />
          {showDropdown && (
            <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg max-h-48 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                 <li className="p-3 text-sm text-slate-500 text-center">Nenhum disponível.</li>
              ) : (
                filteredProducts.map(p => (
                  <li key={p.id} onMouseDown={() => addToCart(p)} className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center group">
                    <span className="text-sm font-medium text-slate-700 truncate" title={p.name}>{p.name}</span>
                    <Plus className="w-4 h-4 text-slate-300 group-hover:text-primary" />
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        {shoppingList.length > 0 && (
          <p className="text-xs text-slate-400 mt-2">{shoppingList.length} produto{shoppingList.length > 1 ? 's' : ''} na lista</p>
        )}
      </div>

      {/* Resultado Otimizado */}
      <div className="space-y-6">
              {shoppingList.length > 0 && orderPlan.summary.total_cost > 0 && (
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 text-white shadow-md flex items-center justify-between">
                  <div>
                    <p className="text-emerald-100 font-medium mb-1 truncate text-sm">Custo Total Projetado</p>
                    <h3 className="text-2xl sm:text-3xl font-bold">R$ {orderPlan.summary.total_cost.toFixed(2)}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-100 font-medium mb-1 text-sm flex items-center gap-1 justify-end">
                       Economia <AlertTriangle className="w-3 h-3 text-amber-200" />
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-bold text-emerald-50">+ R$ {orderPlan.summary.total_savings.toFixed(2)}</h3>
                  </div>
                </div>
              )}

              {shoppingList.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center h-full opacity-50">
                    <ShoppingBagGraphic />
                    <h3 className="text-slate-600 mt-4 font-medium text-lg">Seu Carrinho está Vazio</h3>
                    <p className="text-slate-400 text-sm mt-1">Busque produtos na lista ao lado para a IA calcular os pedidos.</p>
                </div>
              ) : computing ? (
                <div className="p-8 text-center text-slate-400 animate-pulse">Calculando melhor combinação...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(orderPlan.orders).map(([supplier, data]) => {
                    const supTotal = getSupplierTotal(supplier, data);
                    return (
                    <div key={supplier} className={`bg-white rounded-2xl shadow-sm border ${supplier==="Sem Preço Tabela"?'border-red-200':'border-slate-200'} overflow-hidden flex flex-col`}>
                      <div
                        onClick={() => supplier !== "Sem Preço Tabela" && setQtyModalSupplier(supplier)}
                        className={`p-4 border-b flex justify-between items-center cursor-pointer hover:opacity-80 transition-opacity ${supplier==="Sem Preço Tabela"?'bg-red-50 border-red-100 text-red-800':'bg-slate-50/50 border-slate-100 text-slate-800'}`}>
                        <h3 className="font-bold text-sm flex items-center gap-2 truncate whitespace-nowrap">
                          {supplier==="Sem Preço Tabela"? <AlertTriangle className="w-4 h-4 shrink-0" /> : <ShoppingCart className="w-4 h-4 text-primary shrink-0" />}
                          <span className="truncate" title={supplier}>{supplier}</span>
                        </h3>
                        {supplier !== "Sem Preço Tabela" && (
                           <span className="font-bold text-primary shrink-0 ml-2">
                             R$ {supTotal.toFixed(2)}
                           </span>
                        )}
                      </div>
                      
                      <div className="flex-1 p-4">
                        <ul className="space-y-3">
                          {data.items.map((item, idx) => {
                            const qty = getQty(supplier, item.product);
                            return (
                            <li key={idx} className="flex flex-col text-xs group py-1 border-b border-slate-50 last:border-0 relative">
                              <div className="flex justify-between items-center w-full">
                                <button onClick={() => removeFromCart(item.productId || item.id)}
                                  className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-1" title="Remover">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <span className="font-medium truncate mr-2 flex-1" title={item.product}>{item.product}</span>
                                {supplier === "Sem Preço Tabela" ? (
                                  <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded">SEM COTAÇÃO</span>
                                ) : (
                                  <div className="text-right shrink-0 flex items-center gap-2">
                                    <span className="text-slate-400 text-[10px]">×{qty}</span>
                                    <p className="font-bold text-slate-900">R$ {(item.price * qty).toFixed(2)}</p>
                                  </div>
                                )}
                              </div>
                              {item.last_purchase_price && (
                                <div className="pl-5 text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 opacity-80">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                  Última compra: R$ {Number(item.last_purchase_price).toFixed(2)} — {item.last_supplier || 'Desconhecido'} 
                                  {item.last_purchase_date && ` em ${new Date(item.last_purchase_date).toLocaleDateString('pt-BR')}`}
                                </div>
                              )}
                            </li>
                          )})}
                        </ul>
                      </div>

                      <div className="p-3 border-t border-slate-100 bg-slate-50 flex gap-2">
                        <button onClick={() => setQtyModalSupplier(supplier)}
                          className="flex-1 flex items-center justify-center gap-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors">
                          Qtd
                        </button>
                        <button onClick={() => printSupplierOrder(supplier, data)}
                          className="flex-1 flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors">
                          <Printer className="w-3.5 h-3.5" /> Imprimir
                        </button>
                        {supplier !== "Sem Preço Tabela" && (
                          <button className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors">
                            <MessageCircle className="w-3.5 h-3.5" /> Pedido
                          </button>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              )}

              {/* Botão Concluir Pedido */}
              {shoppingList.length > 0 && !computing && (
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button onClick={async () => {
                    if (!window.confirm('Tem certeza que deseja excluir este pedido? A lista será apagada.')) return;
                    const ids = shoppingList.map(i => i.id);
                    setShoppingList([]);
                    setQuantities({});
                    try {
                      await supabase.from('products').update({ in_cart: false }).in('id', ids);
                    } catch(e) {}
                  }}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg">
                    <Trash2 className="w-5 h-5" /> Excluir Pedido
                  </button>
                  <button onClick={finishOrder}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-8 py-3 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg">
                    <CheckCircle className="w-5 h-5" /> Concluir Pedido
                  </button>
                </div>
              )}
          </div>

      {/* Modal de Quantidades */}
      {qtyModalSupplier && orderPlan.orders[qtyModalSupplier] && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setQtyModalSupplier(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{qtyModalSupplier}</h3>
                <p className="text-xs text-slate-500">Defina a quantidade de cada item</p>
              </div>
              <button onClick={() => setQtyModalSupplier(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(orderPlan.orders[qtyModalSupplier].items || []).map((item, idx) => {
                const qty = getQty(qtyModalSupplier, item.product);
                const sub = item.price > 0 ? item.price * qty : 0;
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-800 truncate">{item.product}</p>
                      <p className="text-xs text-slate-400">Unit: R$ {item.price > 0 ? item.price.toFixed(2) : '-'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setQty(qtyModalSupplier, item.product, qty - 1)}
                        className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold text-lg flex items-center justify-center">−</button>
                      <input type="number" min="1" value={qty}
                        onChange={e => setQty(qtyModalSupplier, item.product, e.target.value)}
                        className="w-14 text-center font-bold text-slate-800 border border-slate-300 rounded-lg py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                      <button onClick={() => setQty(qtyModalSupplier, item.product, qty + 1)}
                        className="w-8 h-8 rounded-lg bg-primary hover:bg-primary-dark text-white font-bold text-lg flex items-center justify-center">+</button>
                    </div>
                    <div className="w-24 text-right shrink-0">
                      <p className="font-bold text-slate-800 text-sm">{sub > 0 ? `R$ ${sub.toFixed(2)}` : '-'}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Total */}
            <div className="p-5 border-t border-slate-200 bg-gradient-to-r from-primary/10 to-emerald-50 rounded-b-2xl flex justify-between items-center">
              <span className="font-bold text-slate-700">TOTAL</span>
              <span className="text-2xl font-bold text-primary">
                R$ {getSupplierTotal(qtyModalSupplier, orderPlan.orders[qtyModalSupplier]).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShoppingBagGraphic() {
    return <ShoppingCart className="w-16 h-16 text-slate-300" />;
}
