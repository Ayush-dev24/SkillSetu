import supabase from '../_db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const { data, error } = await supabase.from('companies').select('*').order('id', { ascending: true });
    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    console.error('companies API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
