import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(request, response) {
  // Vercel's body parser seems to be enabled by default
  // No need to manually parse `request.body` if content-type is correct
  const { skillDescription } = request.body;

  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    return response.status(405).end(`Method ${request.method} Not Allowed`);
  }

  if (!skillDescription) {
    return response.status(400).json({ message: 'A descrição da habilidade (skillDescription) é obrigatória.' });
  }

  try {
    const prompt = `Você é um assistente pedagógico especialista em criar atividades engajadoras para o ensino fundamental. Baseado na seguinte habilidade da BNCC: "${skillDescription}", sugira 3 ideias de atividades práticas, criativas e distintas para uma aula. Para cada atividade, dê um título curto e uma descrição de 2-3 frases. Responda em formato JSON, com uma chave "suggestions" que contém um array de objetos, onde cada objeto tem as chaves "title" e "description".`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" },
    });

    const suggestions = JSON.parse(completion.choices[0].message.content);

    return response.status(200).json(suggestions);

  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return response.status(500).json({ message: 'Falha ao obter sugestões da IA.' });
  }
}
