// netlify/functions/get-summary.mjs

export const handler = async (event, context) => {
    // Gestione chiamate "pre-flight" CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const data = JSON.parse(event.body);
        const bookTitle = data.bookTitle;

        if (!bookTitle) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Titolo del libro mancante' })
            };
        }

        // Recupero la chiave sicura dall'ambiente di Netlify
        const API_KEY = process.env.GEMINI_API_KEY;

        if (!API_KEY) {
            console.error(
                "Manca la GEMINI_API_KEY. L'amministratore deve inserirla nelle Impostazioni Environment di Netlify."
            );
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Configurazione Server Mancante' })
            };
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

        const systemPrompt = `Sei un esperto di letteratura e di sintesi concettuale. 
Il tuo compito è analizzare il libro "${bookTitle}" e restituire informazioni dettagliate ed ESATTAMENTE 4 concetti chiave essenziali.
Devi restituire i risultati UNICAMENTE in formato JSON testuale, seguendo perfettamente questa struttura:
{
  "title": "Titolo completo del libro (italiano)",
  "author": "Nome e Cognome dell'autore principale",
  "year": "Anno della prima pubblicazione (es. 1954)",
  "summary": "Un riassunto molto avvincente ed estremamente scorrevole della trama generale o del senso dell'opera della lunghezza di 3 o 4 frasi.",
  "characters": [
    {
      "name": "Nome del personaggio o Protagonista",
      "role": "Una riga che descrive chi è o cosa fa"
    }
  ],
  "concepts": [
    {
      "emoji": "Una singola emoji molto descrittiva che rappresenta e descrive il concetto (es. 🚀, 🧠, 💡)",
      "title": "Titolo breve del concetto...",
      "description": "Una spiegazione in 3-4 frasi chiare e scorrevoli sul perché questo è un concetto chiave del libro."
    }
  ]
}
IMPORTANTE: I characters (protagonisti/personaggi) devono essere massimo 3 o 4. I concepts (concetti chiave) devono essere ESATTAMENTE 4. Restituisci SOLO l'oggetto JSON, senza tag markdown \`\`\`json e senza null'altro.`;

        const requestBody = {
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { temperature: 0.2 }
        };

        // Chiamata vera e propria verso Google, compiuta al sicuro dal Backend
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const rawData = await response.json();

        if (rawData.error) {
            console.error("Errore da Google Gemini:", rawData.error);
            return {
                statusCode: 502,
                body: JSON.stringify({ error: 'Errore durante la comunicazione con AI' })
            };
        }

        // Parsing e pulizia del JSON restituito da Gemini
        let generatedText = rawData.candidates[0].content.parts[0].text;
        generatedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsedData = JSON.parse(generatedText);

        // Risposta JSON al Client Frontend
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(parsedData)
        };

    } catch (error) {
        console.error("Errore Backend:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Errore Server Interno' })
        };
    }
};
