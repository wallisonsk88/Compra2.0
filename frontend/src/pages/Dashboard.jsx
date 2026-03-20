import { useState, useEffect } from "react";
import { TrendingUp, PackageSearch, Truck, Calculator, ShoppingCart } from "lucide-react";
import { supabase, fetchAllRows } from "../lib/supabase";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export default function Dashboard() {
  const [data, setData] = useState({
    total_savings: 0,
    total_quotes: 0,
    total_products: 0,
    total_suppliers: 0,
    recent_deals: []
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);

      const [prodRes, supRes, quoteRes, quotes] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('suppliers').select('*', { count: 'exact', head: true }),
        supabase.from('quotations').select('*', { count: 'exact', head: true }),
        fetchAllRows('quotations_view', '*', 'created_at', { ascending: false })
      ]);

      // Orders em separado para não derrubar tudo se a tabela não existir
      let fetchedOrders = [];
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders').select('*').order('created_at', { ascending: false }).limit(30);
      if (ordersError) {
        console.warn('Erro ao buscar orders:', ordersError.message, ordersError.code);
      } else {
        fetchedOrders = ordersData || [];
      }
      console.log('Orders carregadas:', fetchedOrders.length);

      const prodCount = prodRes.count;
      const supCount = supRes.count;
      const quoteCount = quoteRes.count;

      let totalSavings = 0;
      const recentDealsMap = {};

      if (quotes) {
        const productQuotes = {};
        quotes.forEach(q => {
          if (!productQuotes[q.product_id]) productQuotes[q.product_id] = [];
          productQuotes[q.product_id].push(q);
        });

        Object.values(productQuotes).forEach(prodQuotesList => {
          const bestQuote = prodQuotesList.reduce((min, q) => (q.price < min.price ? q : min), prodQuotesList[0]);
          const otherQuotes = prodQuotesList.filter(q => q.id !== bestQuote.id);

          let savings = 0;
          if (otherQuotes.length > 0) {
            const avgOthers = otherQuotes.reduce((acc, curr) => acc + curr.price, 0) / otherQuotes.length;
            savings = avgOthers - bestQuote.price;
            if (savings < 0) savings = 0;
          }

          if (savings > 0) {
            recentDealsMap[bestQuote.product_id] = {
              product_name: bestQuote.product_name,
              best_supplier: bestQuote.supplier_name,
              best_price: bestQuote.price,
              savings: savings
            };
            totalSavings += savings;
          }
        });
      }

      setData({
        total_products: prodCount || 0,
        total_suppliers: supCount || 0,
        total_quotes: quoteCount || 0,
        total_savings: totalSavings,
        recent_deals: Object.values(recentDealsMap).sort((a, b) => b.savings - a.savings).slice(0, 5)
      });

      setOrders(fetchedOrders);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  // Preparar dados do gráfico
  const chartData = [...orders]
    .reverse()
    .map(o => ({
      data: new Date(o.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      custo: Number(o.total_cost) || 0,
      economia: Number(o.total_savings) || 0,
      itens: o.items_count
    }));

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando painel principal...</div>;

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={TrendingUp} title="Economia Gerada"
          value={`R$ ${data.total_savings.toFixed(2)}`} color="text-emerald-500" bg="bg-emerald-100" />
        <MetricCard
          icon={Calculator} title="Cotações Ativas"
          value={data.total_quotes} color="text-blue-500" bg="bg-blue-100" />
        <MetricCard
          icon={PackageSearch} title="Produtos Cadastrados"
          value={data.total_products} color="text-purple-500" bg="bg-purple-100" />
        <MetricCard
          icon={Truck} title="Fornecedores"
          value={data.total_suppliers} color="text-amber-500" bg="bg-amber-100" />
      </div>

      {/* Gráfico de Compras */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" /> Histórico de Compras
          </h3>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{orders.length} pedidos</span>
        </div>

        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <ShoppingCart className="w-12 h-12 mb-3 text-slate-300" />
            <p className="text-sm">Nenhum pedido concluído ainda.</p>
            <p className="text-xs mt-1">Conclua pedidos na aba "Nova Compra" para ver o gráfico aqui.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="data" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={v => `R$${v}`} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
                formatter={(value, name) => [`R$ ${Number(value).toFixed(2)}`, name === 'custo' ? 'Custo Total' : 'Economia']}
                labelFormatter={l => `📅 ${l}`}
              />
              <Legend formatter={v => v === 'custo' ? 'Custo Total' : 'Economia'} />
              <Bar dataKey="custo" fill="#6366f1" radius={[6, 6, 0, 0]} name="custo" />
              <Bar dataKey="economia" fill="#10b981" radius={[6, 6, 0, 0]} name="economia" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Top Economias */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Maiores Economias Encontradas (Top 5)</h3>
          {data.recent_deals.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400">
              <TrendingUp className="w-12 h-12 mb-3 text-slate-300" />
              <p>Nenhuma cotação com economia registrada ainda.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.recent_deals.map((deal, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <h4 className="font-medium text-slate-800">{deal.product_name}</h4>
                    <span className="text-sm text-slate-500">Melhor fornecedor: {deal.best_supplier}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-500">R$ {deal.best_price.toFixed(2)}</p>
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                      Economiza R$ {deal.savings.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SmartPharma IA Card */}
        <div className="bg-gradient-to-br from-primary-dark to-primary rounded-2xl p-6 shadow-sm text-white flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              MegaFarma IA
            </h3>
            <p className="text-primary-100 text-sm mb-6 opacity-90 leading-relaxed">
              Mantenha o sistema focado em reduzir os custos da sua farmácia.
              Sempre que os representantes passarem, cadastre os preços nos Produtos para montar pedidos otimizados.
            </p>
          </div>
          <Link to="/products" className="w-full bg-white text-primary font-semibold py-3 flex justify-center items-center rounded-lg hover:shadow-lg transition-all active:scale-95 text-center">
            Ir para Produtos
          </Link>
        </div>
      </div>

      {/* Tabela de histórico recente */}
      {orders.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <h3 className="font-semibold text-slate-700 text-sm">Últimos Pedidos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 text-center">Itens</th>
                  <th className="px-4 py-3 text-right">Custo Total</th>
                  <th className="px-4 py-3 text-right">Economia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.slice(0, 10).map(o => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(o.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-700">{o.items_count}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">R$ {Number(o.total_cost).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-xs">
                        + R$ {Number(o.total_savings).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, title, value, color, bg }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 transition-colors">
      <div className={`w-14 h-14 ${bg} ${color} rounded-2xl flex items-center justify-center`}>
        <Icon className="w-7 h-7" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}
