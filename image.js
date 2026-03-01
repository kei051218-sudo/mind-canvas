export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  try {
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const MODEL_ID = 'gemini-3.1-flash-image-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GEMINI_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `Generate a professional abstract art in the style of a master painter. No text, no people: ${prompt}` }]
        }],
        generationConfig: {
          responseModalities: ['IMAGE']
        }
      }),
    });

    const result = await response.json();

    if (result.candidates?.[0]?.content?.parts) {
      const imagePart = result.candidates[0].content.parts.find(p => p.inlineData);
      if (imagePart) {
        const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        return res.status(200).json({ imageUrl });
      }
    }

    return res.status(500).json({ error: result.error?.message || '이미지 데이터가 없습니다.' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
