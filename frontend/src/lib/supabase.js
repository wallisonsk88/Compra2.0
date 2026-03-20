import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Aviso: Credenciais do Supabase ausentes. Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local")
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder_key')

export async function fetchAllRows(tableName, selectQuery = "*", orderCol = null, options = {}) {
  let allData = [];
  let from = 0;
  const step = 999;
  
  while (true) {
    let query = supabase.from(tableName).select(selectQuery).range(from, from + step);
    if (orderCol) query = query.order(orderCol, options);
    
    const { data, error } = await query;
    if (error) throw error;
    
    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length <= step) break;
      from += step + 1;
    } else {
      break;
    }
  }
  return allData;
}
