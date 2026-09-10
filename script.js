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
Analyze the 5v5 draft from the provided image (which may be a draft picking screen, battle setup, or post-match summary).

Constraint Guidelines:
1. Carefully scan all hero avatars on both allies and enemies sides of the screen.
2. Identify team synergy, gaps, and main enemy threats concisely.
3. Recommend exactly 6 build items, 3 emblem talents with brief functional descriptions, and 1 battle spell.
4. Item names MUST match standard MLBB nomenclature (e.g., "Demon Hunter Sword", "Corrosion Scythe", "Golden Staff").
5. Keep explanations brief to ensure rapid execution.
6. Pick 1 hero from our team who is MOST CRITICAL to winning/defeating the enemy team composition.
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

    // Set directly to gemini-3.6-flash
    const primaryModel = 'gemini-3.6-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${primaryModel}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: contents,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.1,
          maxOutputTokens: 1200
        }
      })
    });

    const resData = await response.json();

    if (!response.ok) {
      throw new Error(resData?.error?.message || "Failed to generate draft analysis.");
    }

    const rawText = resData.candidates[0].content.parts[0].text.trim();
    const result = JSON.parse(rawText);
    renderResults(result);

  } catch (error) {
    outputDiv.innerHTML = `<p style="color: #ef4444;">Error: ${error.message}</p>`;
  }
});

function renderResults(data) {
  const outputDiv = document.getElementById('output');
  let html = '';

  if (data.key_hero?.name) {
    const heroImg = `https://mobile-legends.fandom.com/wiki/Special:FilePath/${data.key_hero.name.replace(/\s+/g, '_')}.png`;
    
    html += `
      <div style="background: linear-gradient(135deg, #0284c7 0%, #0f172a 100%); padding: 14px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #38bdf8;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #a5f3fc; font-weight: bold; margin-bottom: 6px;">
          ⭐ Key Team MVP / Counter Hero
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: #1e293b; border: 2px solid #38bdf8; flex-shrink: 0;">
            <img src="${heroImg}" alt="${data.key_hero.name}" loading="lazy" referrerpolicy="no-referrer" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='👑';">
          </div>
          <div>
            <strong style="color: #ffffff; font-size: 14px;">${data.key_hero.name}</strong>
            <div style="font-size: 12px; color: #e0f2fe; margin-top: 2px; line-height: 1.3;">${data.key_hero.reason}</div>
          </div>
        </div>
      </div>
    `;
  }

  html += `
    <div style="background: #0f172a; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
      <h3 style="margin-top:0; color: #38bdf8; font-size: 15px;">Strategic Analysis</h3>
      <p style="color: #cbd5e1; font-size: 13px; margin: 4px 0;"><strong>🤝 Synergy:</strong> ${data.team_analysis?.synergy_notes || 'Complete'}</p>
      ${data.team_analysis?.team_gaps ? `<p style="color: #f87171; font-size: 13px; margin: 4px 0;"><strong>⚠️ Team Gaps:</strong> ${data.team_analysis.team_gaps}</p>` : ''}
      ${data.team_analysis?.enemy_threats ? `<p style="color: #fbbf24; font-size: 13px; margin: 4px 0;"><strong>🎯 Main Threats:</strong> ${data.team_analysis.enemy_threats}</p>` : ''}
    </div>

    <h3 style="color: #38bdf8; font-size: 15px;">Recommended Build Path</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-bottom: 20px;">
  `;

  if (Array.isArray(data.recommended_build)) {
    data.recommended_build.forEach(item => {
      const candidates = getItemImageCandidates(item.name);
      const primaryUrl = candidates[0] || '';

      html += `
        <div style="background: #0f172a; padding: 10px; border-radius: 8px; text-align: center;">
          <div style="width: 48px; height: 48px; margin: 0 auto; border-radius: 8px; overflow: hidden; background: #1e293b; display: flex; align-items: center; justify-content: center; border: 1px solid #38bdf8;">
            <img 
              src="${primaryUrl}" 
              alt="${item.name}" 
              loading="lazy" 
              referrerpolicy="no-referrer"
              style="width: 100%; height: 100%; object-fit: cover;" 
              onerror="this.onerror=null; this.parentElement.innerHTML='🛡️';"
            >
          </div>
          <div style="font-weight: bold; font-size: 11px; margin: 6px 0 2px 0; color: #f8fafc;">${item.name}</div>
          <div style="font-size: 10px; color: #94a3b8; line-height: 1.2;">${item.reason}</div>
        </div>
      `;
    });
  }

  const emblemImg = getAssetImageUrl(data.emblem?.name, 'emblem');

  html += `</div>
    <h3 style="color: #38bdf8; font-size: 15px;">Emblem & Talents</h3>
    <div style="background: #0f172a; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <div style="width: 28px; height: 28px; border-radius: 4px; overflow: hidden; background: #1e293b; display: flex; align-items: center; justify-content: center;">
          <img src="${emblemImg}" alt="Emblem" loading="lazy" referrerpolicy="no-referrer" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.onerror=null; this.parentElement.innerHTML='🌀';">
        </div>
        <strong style="color: #38bdf8; font-size: 14px;">${data.emblem?.name || 'Custom Emblem'}</strong>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
  `;

  if (Array.isArray(data.emblem?.talents)) {
    data.emblem.talents.forEach(talent => {
      const talentName = typeof talent === 'object' ? talent.name : talent;
      const talentDesc = typeof talent === 'object' ? talent.description : '';
      const talentImg = getAssetImageUrl(talentName, 'talent');

      html += `
        <div style="background: #1e293b; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #38bdf8; display: flex; align-items: flex-start; gap: 10px;">
          <img src="${talentImg}" alt="${talentName}" loading="lazy" referrerpolicy="no-referrer" style="width: 20px; height: 20px; object-fit: contain; margin-top: 2px;" onerror="this.onerror=null; this.parentElement.innerHTML='⚡';">
          <div>
            <div style="color: #f8fafc; font-size: 12px; font-weight: bold;">${talentName}</div>
            ${talentDesc ? `<div style="color: #94a3b8; font-size: 11px; margin-top: 2px; line-height: 1.3;">${talentDesc}</div>` : ''}
          </div>
        </div>
      `;
    });
  }

  const spellImg = getAssetImageUrl(data.battle_spell?.name, 'spell');

  html += `</div></div>
    <h3 style="color: #38bdf8; font-size: 15px;">Battle Spell</h3>
    <div style="background: #0f172a; padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 12px;">
      <div style="background: #0284c7; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid #38bdf8; flex-shrink: 0;">
        <img src="${spellImg}" alt="${data.battle_spell?.name || 'Spell'}" loading="lazy" referrerpolicy="no-referrer" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='✨';">
      </div>
      <div>
        <strong style="color: #f8fafc; font-size: 13px;">${data.battle_spell?.name || 'Execute'}</strong>
        <div style="font-size: 11px; color: #94a3b8;">${data.battle_spell?.reason || ''}</div>
      </div>
    </div>
  `;

  outputDiv.innerHTML = html;
}
