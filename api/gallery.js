export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase 환경변수 없음' });
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?is_public=eq.true&order=created_at.desc&select=id,created_at,title,emotions,image_url`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: errorText });
    }

    const items = await response.json();
    return res.status(200).json({ items });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
