export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ success: false, error: 'Supabase 환경변수 없음' });
  }

  try {
    const body = req.body;

    const response = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        emotions: body.emotions || [],
        intensity: body.intensity || 3,
        colors: body.colors || [],
        shapes: body.shapes || [],
        space_scene: body.space_scene || '',
        art_style: body.art_style || '',
        prompt_ko: body.prompt_ko || '',
        coaching_questions: body.coaching_questions || [],
        conversation_summary: body.conversation_summary || '',
        image_url: body.image_url || ''
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ success: false, error: errorText });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
