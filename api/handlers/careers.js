import supabase from '../db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const { data, error } = await supabase.from('careers').select('*').order('demand_index', { ascending: false });
    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    console.error('careers API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
