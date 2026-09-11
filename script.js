window.addEventListener('DOMContentLoaded', async () => {
  const savedKey = localStorage.getItem('mlbb_gemini_key');
  if (savedKey) {
    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) apiKeyInput.value = savedKey;
  }

  await loadDynamicHeroList();
});

async function loadDynamicHeroList() {
  const heroListContainer = document.getElementById('heroList');
  if (!heroListContainer) return;

  try {
    const response = await fetch('https://raw.githubusercontent.com/akabab/mobile-legends-api/master/api/heroes.json');
    if (!response.ok) throw new Error('Primary source unavailable');
    
    const data = await response.json();
    const heroNames = data.map(hero => hero.name || hero.hero_name).filter(Boolean);
    populateDatalist(heroNames);
  } catch (error) {
    const defaultHeroes = [
      "Miya", "Balmond", "Saber", "Alice", "Nana", "Tigreal", "Alucard", "Karina", "Akai", "Franco", 
      "Bane", "Bruno", "Clint", "Rafaela", "Eudora", "Zilong", "Fanny", "Freya", "Gord", "Natalia", 
      "Kagura", "Chou", "Sun", "Alpha", "Ruby", "Yi Sun-shin", "Moskov", "Johnson", "Cyclops", "Estes", 
      "Hilda", "Aurora", "Lapu-Lapu", "Vexana", "Harley", "Irithel", "Grock", "Argus", "Odette", "Lancelot", 
      "Diggie", "Hylos", "Zhask", "Helcurt", "Pharsa", "Lesley", "Jawhead", "Angela", "Gusion", "Chang'e", 
      "Uranus", "Hanabi", "Selena", "Aldous", "Claude", "Vale", "Leomord", "Lunox", "Hanzo", "Belerick", 
      "Kimmy", "Thamuz", "Harith", "Minsitthar", "Kadita", "Faramis", "Badang", "Khufra", "Granger", "Guinevere", 
      "Esmeralda", "Terizla", "X.Borg", "Ling", "Dyrroth", "Lylia", "Baxia", "Masha", "Wanwan", "Silvanna", 
      "Cecilion", "Carmilla", "Atlas", "Popol and Kupa", "Yu Zhong", "Luo Yi", "Benedetta", "Khaleed", "Barats", 
      "Brody", "Yve", "Mathilda", "Paquito", "Gloo", "Beatrix", "Phoveus", "Natan", "Aulus", "Aamon", "Valentina", 
      "Edith", "Yin", "Melissa", "Xavier", "Julian", "Fredrinn", "Joy", "Novaria", "Ixia", "Nolan", "Cici", 
      "Chip", "Suyou", "Lukas"
    ];
    populateDatalist(defaultHeroes);
  }
}

function populateDatalist(heroNames) {
  const heroListContainer = document.getElementById('heroList');
  if (!heroListContainer) return;

  const uniqueHeroes = [...new Set(heroNames)].sort();
  heroListContainer.innerHTML = uniqueHeroes
    .map(name => `<option value="${name}">`)
    .join('');
}

const SYSTEM_PROMPT = `
You are an expert Mobile Legends: Bang Bang (MLBB) Draft Analyzer.
Analyze the 5v5 draft from the provided image.

Constraint Guidelines:
1. Scan hero avatars on both ally and enemy sides.
2. Keep explanations strictly under 10 words per item/reason to ensure complete JSON output without cutoffs.
3. Recommend exactly 6 build items, 3 emblem talents, and 1 battle spell.
4. Item names MUST match standard MLBB nomenclature (e.g., "Demon Hunter Sword", "Corrosion Scythe").
`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    key_hero: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        reason: { type: "STRING" }
      },
      required: ["name", "reason"]
    },
    team_analysis: {
      type: "OBJECT",
      properties: {
        synergy_notes: { type: "STRING" },
        team_gaps: { type: "STRING" },
        enemy_threats: { type: "STRING" }
      },
      required: ["synergy_notes", "team_gaps", "enemy_threats"]
    },
    recommended_build: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          reason: { type: "STRING" }
        },
        required: ["name", "reason"]
      }
    },
    emblem: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        talents: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              description: { type: "STRING" }
            },
            required: ["name", "description"]
          }
        }
      },
      required: ["name", "talents"]
    },
    battle_spell: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        reason: { type: "STRING" }
      },
      required: ["name", "reason"]
    }
  },
  required: ["key_hero", "team_analysis", "recommended_build", "emblem", "battle_spell"]
};

function getItemImageCandidates(itemName) {
  if (!itemName) return [];
  const cleanName = itemName.trim();
  const formattedName = cleanName.replace(/\s+/g, '_').replace(/'/g, '%27');

  return [
    `https://mobile-legends.fandom.com/wiki/Special:FilePath/${formattedName}.png`,
    `https://mobile-legends.fandom.com/wiki/Special:FilePath/${formattedName}.jpg`,
    `./assets/items/${formattedName.toLowerCase()}.png`
  ];
}

function getAssetImageUrl(name, type) {
  if (!name) return '';
  const formattedName = name.trim().replace(/\s+/g, '_').replace(/'/g, '%27');
  return `https://mobile-legends.fandom.com/wiki/Special:FilePath/${formattedName}${type === 'talent' ? '_Talent' : ''}.png`;
}

function processAndResizeImage(file, maxDimension = 720) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        resolve({
          inlineData: {
            data: dataUrl.split(',')[1],
            mimeType: 'image/jpeg'
          }
        });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const heroInput = document.getElementById('heroInput');
  const hero = heroInput ? heroInput.value.trim() : '';
  const fileInput = document.getElementById('imageInput');
  const outputDiv = document.getElementById('output');
  const resultCard = document.getElementById('resultCard');

  if (!apiKey || !hero) {
    alert('Please enter your API Key and Hero name.');
    return;
  }

  localStorage.setItem('mlbb_gemini_key', apiKey);
  if (resultCard) resultCard.classList.remove('hidden');
  outputDiv.innerHTML = '<p style="color: #38bdf8;">Analyzing draft details...</p>';

  try {
    const contents = [{
      parts: [{ text: `Playing Hero: ${hero}. Analyze draft lineup from the image, select key counter hero, and output build with talent descriptions.` }]
    }];

    if (fileInput && fileInput.files.length > 0) {
      const optimizedImage = await processAndResizeImage(fileInput.files[0], 720);
      contents[0].parts.push(optimizedImage);
    }

    // Using supported API models sequentially
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    let resData = null;
    let response = null;
    let lastError = null;

    for (const model of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: contents,
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: RESPONSE_SCHEMA
            }
          })
        });

        resData = await response.json();
        if (response.ok) break;
        lastError = resData?.error?.message || `API Error ${response.status}`;
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!response || !response.ok) {
      throw new Error(lastError || "Failed to reach Gemini API.");
    }

    let rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Empty response received from API.");
    }

    // Clean JSON markdown code blocks if wrapped by API
    rawText = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*
