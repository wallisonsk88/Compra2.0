import { useState, useEffect } from "react";
import { Plus, Search, Truck, MapPin, Phone, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Form stats
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSupplier(e) {
    e.preventDefault();
    try {
      const { data, error } = await supabase.from("suppliers").insert([
        { name, location, contact, delivery_time: deliveryTime }
      ]).select();
      
      if (error) throw error;
      
      setSuppliers([...suppliers, data[0]]);
      setShowForm(false);
      setName(""); setLocation(""); setContact(""); setDeliveryTime("");
    } catch (error) {
      console.error(error);
      alert("Erro ao adicionar fornecedor.");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Deseja realmente excluir este fornecedor?")) return;
    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
      setSuppliers(suppliers.filter(s => s.id !== id));
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Fornecedores</h2>
          <p className="text-slate-500 text-sm">Gerencie os contatos das distribuidoras</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 flex items-center gap-2 rounded-xl transition-colors shadow-sm font-medium"
        >
          <Plus className="w-5 h-5" /> {showForm ? "Cancelar" : "Novo Fornecedor"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h3 className="font-semibold text-lg mb-4 text-slate-800">Novo Fornecedor</h3>
          <form onSubmit={handleAddSupplier} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <input type="text" placeholder="Nome do Fornecedor" value={name} onChange={e => setName(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <input type="text" placeholder="Localização (Ex: SP)" value={location} onChange={e => setLocation(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <input type="text" placeholder="Contato / WhatsApp" value={contact} onChange={e => setContact(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <input type="text" placeholder="Prazo (Ex: 48h)" value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg px-4 py-2 transition-colors">Salvar Fornecedor</button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex gap-4 bg-slate-50/50">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar (ainda visual)"
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-sm uppercase font-semibold">
                <th className="px-6 py-4">Fornecedor</th>
                <th className="px-6 py-4">Localização</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4 text-right">Prazo Médio</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500">Carregando fornecedores...</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500">Nenhum fornecedor cadastrado.</td></tr>
              ) : (
                suppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                          <Truck className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-slate-800">{sup.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-slate-400" /> {sup.location || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center gap-1">
                        <Phone className="w-4 h-4 text-slate-400" /> {sup.contact || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700 text-right">
                      <span className="bg-slate-100 px-3 py-1 rounded-full text-sm">
                        {sup.delivery_time || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => handleDelete(sup.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
