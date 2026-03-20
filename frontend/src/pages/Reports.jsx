import { useState, useEffect, useMemo, Fragment } from "react";
import { FileText, Download, Printer, ChevronDown, ChevronUp, Calendar, TrendingUp, ShoppingCart, Package } from "lucide-react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

export default function Reports() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => { fetchOrders(); }, []);

  async function fetchOrders() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (e) {
      console.error("Erro ao buscar pedidos:", e);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const d = new Date(o.created_at);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59);
        if (d > to) return false;
      }
      return true;
    });
  }, [orders, dateFrom, dateTo]);

  const totals = useMemo(() => {
    return filteredOrders.reduce((acc, o) => ({
      cost: acc.cost + Number(o.total_cost || 0),
      savings: acc.savings + Number(o.total_savings || 0),
      items: acc.items + (o.items_count || 0)
    }), { cost: 0, savings: 0, items: 0 });
  }, [filteredOrders]);

  // === Exportar Excel ===
  function exportExcel() {
    const rows = [];
    filteredOrders.forEach(o => {
      const date = new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const details = o.details || {};

      // Uma linha por fornecedor/item
      Object.entries(details).forEach(([supplier, data]) => {
        (data.items || []).forEach(item => {
          rows.push({
            "Data": date,
            "Pedido #": o.id,
            "Fornecedor": supplier,
            "Produto": item.product,
            "Preço (R$)": item.price ? Number(item.price).toFixed(2) : "Sem cotação",
            "Economia (R$)": item.savings ? Number(item.savings).toFixed(2) : "0.00",
          });
        });
      });

      // Linha vazia entre pedidos
      if (Object.keys(details).length === 0) {
        rows.push({ "Data": date, "Pedido #": o.id, "Fornecedor": "-", "Produto": "-", "Preço (R$)": Number(o.total_cost).toFixed(2), "Economia (R$)": Number(o.total_savings).toFixed(2) });
      }
    });

    // Linha de totais
    rows.push({});
    rows.push({ "Data": "TOTAL", "Pedido #": `${filteredOrders.length} pedidos`, "Fornecedor": "", "Produto": `${totals.items} itens`, "Preço (R$)": totals.cost.toFixed(2), "Economia (R$)": totals.savings.toFixed(2) });

    const ws = XLSX.utils.json_to_sheet(rows);
    // Ajustar largura das colunas
    ws["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
    XLSX.writeFile(wb, `MegaFarma_Pedidos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // === Imprimir / PDF ===
  function printReport() {
    window.print();
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando relatórios...</div>;

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Relatório de Pedidos
          </h2>
          <p className="text-slate-500 text-sm">Histórico completo de compras com detalhes de fornecedores e economia.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 flex items-center gap-2 rounded-xl transition-colors font-medium text-sm shadow-sm">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={printReport}
            className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 flex items-center gap-2 rounded-xl transition-colors font-medium text-sm shadow-sm">
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Print Header (só aparece ao imprimir) */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-2xl font-bold">MegaFarma — Relatório de Pedidos</h1>
        <p className="text-sm text-gray-500">Gerado em {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Período:</span>
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none" />
        <span className="text-slate-400 text-sm">até</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none" />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-primary hover:underline">Limpar</button>
        )}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:grid-cols-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-500 rounded-2xl flex items-center justify-center">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Pedidos</p>
            <p className="text-xl font-bold text-slate-800">{filteredOrders.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 text-purple-500 rounded-2xl flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Gasto</p>
            <p className="text-xl font-bold text-slate-800">R$ {totals.cost.toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-500 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Economia Total</p>
            <p className="text-xl font-bold text-emerald-600">R$ {totals.savings.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Tabela de Pedidos */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border print:rounded-none">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Nenhum pedido encontrado{dateFrom || dateTo ? " neste período" : ""}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                  <th className="px-4 py-3 w-10 print:hidden"></th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 text-center">Itens</th>
                  <th className="px-4 py-3 text-right">Custo Total</th>
                  <th className="px-4 py-3 text-right">Economia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map(order => {
                  const isExpanded = expandedId === order.id;
                  const details = order.details || {};
                  const supplierEntries = Object.entries(details);

                  return (
                    <Fragment key={order.id}>
                      <tr className={`cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-primary/5' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                        <td className="px-4 py-3 print:hidden">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          <span className="text-slate-400 text-xs ml-1">
                            {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{order.items_count}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">R$ {Number(order.total_cost).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-emerald-600">+ R$ {Number(order.total_savings).toFixed(2)}</span>
                        </td>
                      </tr>

                      {/* Detalhes expandidos */}
                      {(isExpanded || false) && supplierEntries.length > 0 && (
                        <tr>
                          <td colSpan={5} className="bg-slate-50/80 px-4 py-3 print:bg-white">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-4xl">
                              {supplierEntries.map(([supplier, data]) => (
                                <div key={supplier} className={`rounded-xl border p-3 ${supplier === 'Sem Preço Tabela' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                                  <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${supplier === 'Sem Preço Tabela' ? 'text-red-600' : 'text-primary'}`}>
                                    {supplier}
                                    {data.supplier_total > 0 && (
                                      <span className="float-right normal-case text-slate-700">R$ {Number(data.supplier_total).toFixed(2)}</span>
                                    )}
                                  </h4>
                                  <ul className="space-y-1">
                                    {(data.items || []).map((item, idx) => (
                                      <li key={idx} className="flex justify-between text-xs text-slate-600">
                                        <span className="truncate mr-2">{item.product}</span>
                                        {item.price > 0 ? (
                                          <span className="shrink-0 font-semibold">R$ {Number(item.price).toFixed(2)}</span>
                                        ) : (
                                          <span className="shrink-0 text-red-400 font-semibold">Sem cotação</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-sm">
                  <td className="px-4 py-3 print:hidden"></td>
                  <td className="px-4 py-3 text-slate-600">TOTAL</td>
                  <td className="px-4 py-3 text-center text-slate-600">{totals.items} itens</td>
                  <td className="px-4 py-3 text-right text-slate-800">R$ {totals.cost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">+ R$ {totals.savings.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
