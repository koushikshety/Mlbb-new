// 1. MLBB Rules System Prompt
const SYSTEM_PROMPT = `
You are an expert Mobile Legends: Bang Bang (MLBB) Draft & Item Build Analyzer.
Your task is to analyze 5v5 enemy and friendly team lineups (via image screenshot or text list) and generate optimized item builds, emblem talents, and battle spells.

Rules & Counter Mechanics:
1. Equipment Caps: Attack Speed (3.00 standard, 5.00 with Inspire), CDR (40% standard, 45% with Enchanted Talisman).
2. Counter Mechanics:
   - High HP/Tanky Enemies: Counter using % HP damage (Demon Hunter Sword for Physical, Wishing Lantern / Glowing Wand for Magic, Sea Halberd for anti-hp/regen).
   - High Burst/Physical: Counter with Wind of Nature, Antique Cuirass, Blade Armor, or Winter Crown.
   - High Regen/Shields: Recommend anti-heal (Sea Halberd, Glowing Wand, Dominance Ice).
   - High Magic Burst: Athena's Shield, Radiant Armor, or Rose Gold Meteor.

Output Format:
1. Identified Team Lineups (Your Hero & Role, Allies, Enemies)
2. Strategic Matchup Analysis (Key threats & counterplay)
3. Full 6-Item Build Path with exact purchase reasoning
4. Recommended Emblem & Sub-Talents
5. Recommended Battle Spell
`;

// 2. Helper to convert image File to Base64
function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 3. Button Click Handler
document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const hero = document.getElementById('heroInput').value.trim();
  const fileInput = document.getElementById('imageInput');
  const outputDiv = document.getElementById('output');
  const resultCard = document.getElementById('resultCard');

  if (!apiKey) {
    alert('Please enter your Gemini API key.');
    return;
  }
  if (!hero) {
    alert('Please enter the hero you are playing.');
    return;
  }

  resultCard.style.display = 'block';
  outputDiv.innerText = 'Analyzing draft screenshot with Gemini 2.5 Flash...';

  try {
    // Build content array (Text prompt + image if uploaded)
    const contents = [
      {
        parts: [
          { text: `I am playing as ${hero}. Analyze this draft screenshot and provide counter builds, emblems, and spells.` }
        ]
      }
    ];

    if (fileInput.files.length > 0) {
      const imagePart = await fileToGenerativePart(fileInput.files[0]);
      contents[0].parts.push(imagePart);
    }

    // Direct REST call to Gemini 2.5 Flash endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: contents
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data, null, 2));
    }

    // Extract generated text response
    const analysisText = data.candidates[0].content.parts[0].text;
    outputDiv.innerText = analysisText;

  } catch (error) {
    outputDiv.innerText = `Error: ${error.message}`;
  }
});
