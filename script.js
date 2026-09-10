// 1. Auto-load saved API Key
window.addEventListener('DOMContentLoaded', () => {
  const savedKey = localStorage.getItem('mlbb_gemini_key');
  if (savedKey) {
    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) apiKeyInput.value = savedKey;
  }
});

// 2. Enhanced System Prompt (Team Synergy + Counter Strategy)
const SYSTEM_PROMPT = `
You are an expert Mobile Legends: Bang Bang (MLBB) Draft Analyzer.
Analyze the 5v5 enemy and allied draft from the image or text input.

Tasks:
1. Identify enemy team composition & main threats.
2. Identify allied team synergy & main weaknesses/gaps (e.g., lack of CC, squishy frontline, heavy magic damage).
3. Provide optimal item build, emblems, and battle spell to fix your team's weakness and counter enemies.

Respond ONLY in valid JSON format:
{
  "allies_detected": ["Hero1", "Hero2", "Hero3", "Hero4"],
  "enemies_detected": ["Hero1", "Hero2", "Hero3", "Hero4", "Hero5"],
  "team_analysis": {
    "synergy_notes": "How your hero works with allies",
    "team_gaps": "What your team lacks (e.g. no anti-regen, weak frontline)",
    "enemy_threats": "Main enemy dangers to watch out for"
  },
  "recommended_build": [
    {"name": "Demon Hunter Sword", "reason": "Counter high HP tank"},
    {"name": "Tough Boots", "reason": "Reduce CC duration"},
    {"name": "Corrosion Scythe", "reason": "Slow enemies"},
    {"name": "Golden Staff", "reason": "Boost attack speed"},
    {"name": "Wind of Nature", "reason": "Immunity to physical burst"},
    {"name": "Immortality", "reason": "Late game survival"}
  ],
  "emblem": {
    "name": "Custom Assassin Emblem",
    "talents": ["Rupture", "Master Assassin", "Lethal Ignition"]
  },
  "battle_spell": {
    "name": "Flicker",
    "reason": "Mobility & positioning"
  }
}
`;

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
  outputDiv.innerHTML = '<p>Analyzing draft & team composition...</p>';

  try {
    const contents = [{
      parts: [{ text: `I am playing ${hero}. Read draft image, identify all 10 heroes, analyze team weaknesses and give optimal counter build.` }]
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
          maxOutputTokens: 1000
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

// Helper function to get clean UI image icons
function getItemIcon(itemName) {
  const formatted = encodeURIComponent(itemName.replace(/\s+/g, '_'));
  return `https://akm-img-a-in.tos-cn-beijing.volces.com/mobilelegends/item/${formatted}.png`;
}

function renderResults(data) {
  const outputDiv = document.getElementById('output');

  let html = `
    <!-- Team & Draft Analysis Section -->
    <div style="background: #0f172a; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
      <h4 style="margin-top:0; color: #38bdf8;">Draft & Team Analysis</h4>
      <p style="font-size: 13px; margin: 4px 0;"><strong>🤝 Team Synergy:</strong> ${data.team_analysis.synergy_notes}</p>
      <p style="font-size: 13px; margin: 4px 0;"><strong>⚠️ Team Gaps/Weakness:</strong> ${data.team_analysis.team_gaps}</p>
      <p style="font-size: 13px; margin: 4px 0;"><strong>🎯 Main Enemy Threats:</strong> ${data.team_analysis.enemy_threats}</p>
    </div>

    <!-- Recommended Build Section -->
    <h4 style="color: #38bdf8;">Recommended Build Path</h4>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin-bottom: 20px;">
  `;

  data.recommended_build.forEach(item => {
    // Uses fallback UI avatar if item image fails to load
    html += `
      <div style="background: #0f172a; padding: 8px; border-radius: 8px; text-align: center;">
        <img src="https://img.icons8.com/color/48/sword.png" 
             alt="${item.name}" 
             style="width: 40px; height: 40px; border-radius: 50%; background: #1e293b; padding: 4px;"
             onerror="this.src='https://img.icons8.com/color/48/shield.png';">
        <div style="font-weight: bold; font-size: 11px; margin: 4px 0; color: #f8fafc;">${item.name}</div>
        <div style="font-size: 10px; color: #94a3b8;">${item.reason}</div>
      </div>
    `;
  });

  html += `</div>
    <!-- Emblem & Talents Section -->
    <h4 style="color: #38bdf8;">Emblem & Talents</h4>
    <div style="background: #0f172a; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
      <strong style="color: #f8fafc; font-size: 13px;">${data.emblem.name}</strong>
      <div style="display: flex; gap: 12px; margin-top: 8px;">
  `;

  data.emblem.talents.forEach(talent => {
    html += `
      <div style="text-align: center;">
        <span style="background: #0ea5e9; color: #fff; font-size: 10px; padding: 3px 8px; border-radius: 12px; font-weight: bold;">
          ${talent}
        </span>
      </div>
    `;
  });

  html += `</div></div>
    <!-- Battle Spell Section -->
    <h4 style="color: #38bdf8;">Battle Spell</h4>
    <div style="background: #0f172a; padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 12px;">
      <div style="background: #0284c7; padding: 8px; border-radius: 50%; width: 24px; height: 24px; text-align: center; font-weight: bold;">⚡</div>
      <div>
        <strong style="color: #f8fafc; font-size: 13px;">${data.battle_spell.name}</strong>
        <div style="font-size: 11px; color: #94a3b8;">${data.battle_spell.reason}</div>
      </div>
    </div>
  `;

  outputDiv.innerHTML = html;
}
