// 1. Auto-load saved API Key from localStorage
window.addEventListener('DOMContentLoaded', () => {
  const savedKey = localStorage.getItem('mlbb_gemini_key');
  if (savedKey) {
    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) {
      apiKeyInput.value = savedKey;
    }
  }
});

// 2. System Prompt
const SYSTEM_PROMPT = `
You are an expert MLBB Draft Analyzer. Analyze the team lineups from the input.
Keep descriptions extremely short (under 10 words per item/spell).

Respond ONLY in valid JSON format:
{
  "matchup_analysis": "Short 1-2 sentence strategy summary.",
  "recommended_build": [
    {"name": "Demon Hunter Sword", "reason": "Counter high HP"},
    {"name": "Warrior Boots", "reason": "Physical defense"},
    {"name": "Corrosion Scythe", "reason": "Attack speed & slow"},
    {"name": "Golden Staff", "reason": "Trigger passives"},
    {"name": "Wind of Nature", "reason": "Immunity vs physical burst"},
    {"name": "Immortality", "reason": "Late game revive"}
  ],
  "emblem": {
    "name": "Custom Assassin Emblem",
    "talents": ["Rupture", "Master Assassin", "Lethal Ignition"]
  },
  "battle_spell": {
    "name": "Flicker",
    "reason": "Mobility & escape"
  }
}
`;

// 3. Image conversion helper
function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({
      inlineData: {
        data: reader.result.split(',')[1],
        mimeType: file.type
      }
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 4. Click Handler
document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const hero = document.getElementById('heroInput').value.trim();
  const fileInput = document.getElementById('imageInput');
  const outputDiv = document.getElementById('output');
  const resultCard = document.getElementById('resultCard');

  if (!apiKey || !hero) {
    alert('Please enter your API Key and Hero.');
    return;
  }

  localStorage.setItem('mlbb_gemini_key', apiKey);

  resultCard.style.display = 'block';
  outputDiv.innerHTML = '<p>Analyzing draft...</p>';

  try {
    const contents = [{
      parts: [{ text: `Hero: ${hero}. Analyze draft image and give builds.` }]
    }];

    if (fileInput.files.length > 0) {
      const imagePart = await fileToGenerativePart(fileInput.files[0]);
      contents[0].parts.push(imagePart);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: contents,
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 600
        }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data, null, 2));

    const result = JSON.parse(data.candidates[0].content.parts[0].text);
    renderResults(result);

  } catch (error) {
    outputDiv.innerText = `Error: ${error.message}`;
  }
});

// 5. Render Response
function renderResults(data) {
  const outputDiv = document.getElementById('output');
  
  let html = `
    <h4>Strategic Analysis</h4>
    <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 16px;">${data.matchup_analysis}</p>

    <h4>Recommended Build Path</h4>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-bottom: 20px;">
  `;

  data.recommended_build.forEach(item => {
    html += `
      <div style="background: #0f172a; padding: 10px; border-radius: 8px; text-align: center;">
        <img src="https://mobile-legends.fandom.com/wiki/Special:Redirect/file/${encodeURIComponent(item.name)}.png" 
             alt="${item.name}" 
             style="width: 44px; height: 44px; object-fit: contain; border-radius: 50%;"
             onerror="this.src='https://placehold.co/44x44?text=Item';">
        <div style="font-weight: bold; font-size: 12px; margin: 4px 0;">${item.name}</div>
        <div style="font-size: 10px; color: #94a3b8;">${item.reason}</div>
      </div>
    `;
  });

  html += `</div><h4>Emblem & Talents</h4><div style="background: #0f172a; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
    <strong style="color: #38bdf8; font-size: 14px;">${data.emblem.name}</strong>
    <div style="display: flex; gap: 16px; margin-top: 10px;">
  `;

  data.emblem.talents.forEach(talent => {
    html += `
      <div style="text-align: center;">
        <img src="https://mobile-legends.fandom.com/wiki/Special:Redirect/file/${encodeURIComponent(talent)}.png" 
             alt="${talent}" 
             style="width: 38px; height: 38px; border-radius: 50%;"
             onerror="this.src='https://placehold.co/38x38?text=Talent';">
        <div style="font-size: 11px; margin-top: 2px;">${talent}</div>
      </div>
    `;
  });

  html += `</div></div><h4>Battle Spell</h4><div style="background: #0f172a; padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 12px;">
    <img src="https://mobile-legends.fandom.com/wiki/Special:Redirect/file/${encodeURIComponent(data.battle_spell.name)}.png" 
         alt="${data.battle_spell.name}" 
         style="width: 44px; height: 44px; border-radius: 50%;"
         onerror="this.src='https://placehold.co/44x44?text=Spell';">
    <div>
      <strong style="color: #38bdf8; font-size: 14px;">${data.battle_spell.name}</strong>
      <div style="font-size: 11px; color: #94a3b8;">${data.battle_spell.reason}</div>
    </div>
  </div>`;

  outputDiv.innerHTML = html;
}
