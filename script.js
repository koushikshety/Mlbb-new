// 1. Auto-load saved API Key on page load
window.addEventListener('DOMContentLoaded', () => {
  const savedKey = localStorage.getItem('mlbb_gemini_key');
  if (savedKey) {
    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) {
      apiKeyInput.value = savedKey;
    }
  }
});

// 2. Draft & Team Synergy System Prompt
const SYSTEM_PROMPT = `
You are an expert Mobile Legends: Bang Bang (MLBB) Draft Analyzer.
Analyze the 5v5 draft from the provided image or text input.

Tasks:
1. Identify team synergy, team gaps/weaknesses, and main enemy threats.
2. Recommend an optimal counter-build path, emblems, and battle spell.
3. Keep reasons short (under 10 words per item/spell).

Respond ONLY in valid JSON format:
{
  "team_analysis": {
    "synergy_notes": "Short 1-2 sentence team synergy overview.",
    "team_gaps": "Main team weaknesses or gaps.",
    "enemy_threats": "Key enemy threats to watch out for."
  },
  "recommended_build": [
    {"name": "Demon Hunter Sword", "reason": "Counter high HP tanks"},
    {"name": "Tough Boots", "reason": "Reduce CC duration"},
    {"name": "Corrosion Scythe", "reason": "Slow enemy movement"},
    {"name": "Golden Staff", "reason": "Trigger item passives"},
    {"name": "Wind of Nature", "reason": "Immunity to physical burst"},
    {"name": "Immortality", "reason": "Late game revive"}
  ],
  "emblem": {
    "name": "Custom Support Emblem",
    "talents": ["Agility", "Pull Yourself Together", "Focusing Mark"]
  },
  "battle_spell": {
    "name": "Flicker",
    "reason": "Mobility & quick escape"
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

// Helper: Sleep function for retry delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 4. Submit & Analyze Button Handler
document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const hero = document.getElementById('heroInput').value.trim();
  const fileInput = document.getElementById('imageInput');
  const outputDiv = document.getElementById('output');
  const resultCard = document.getElementById('resultCard');

  if (!apiKey || !hero) {
    alert('Please enter your API Key and Hero name.');
    return;
  }

  // Save key to local storage permanently
  localStorage.setItem('mlbb_gemini_key', apiKey);

  resultCard.style.display = 'block';
  outputDiv.innerHTML = '<p style="color: #38bdf8;">Analyzing draft & team composition...</p>';

  try {
    const contents = [{
      parts: [{ text: `I am playing ${hero}. Read draft image, analyze team synergy/gaps, and give builds.` }]
    }];

    if (fileInput.files.length > 0) {
      const imagePart = await fileToGenerativePart(fileInput.files[0]);
      contents[0].parts.push(imagePart);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    let response = null;
    let resData = null;
    const maxRetries = 3;

    // Retry loop with delay for 503 capacity spikes
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt > 1) {
        outputDiv.innerHTML = `<p style="color: #fbbf24;">Server busy, retrying (${attempt}/${maxRetries})...</p>`;
        await delay(2000); // Wait 2 seconds before retrying
      }

      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: contents,
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 2048
          }
        })
      });

      resData = await response.json();

      if (response.ok) {
        break; // Request succeeded
      }

      // If error is not 503 (e.g. invalid API key or bad request), don't retry
      if (response.status !== 503) {
        throw new Error(JSON.stringify(resData, null, 2));
      }
    }

    if (!response || !response.ok) {
      throw new Error(JSON.stringify(resData, null, 2));
    }

    const result = JSON.parse(resData.candidates[0].content.parts[0].text);
    renderResults(result);

  } catch (error) {
    outputDiv.innerHTML = `<p style="color: #ef4444;">Error: ${error.message}</p>`;
  }
});

// 5. Render JSON response with styled badges
function renderResults(data) {
  const outputDiv = document.getElementById('output');

  let html = `
    <!-- Strategic Analysis Card -->
    <div style="background: #0f172a; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
      <h4 style="margin-top:0; color: #38bdf8;">Strategic Analysis</h4>
      <p style="color: #cbd5e1; font-size: 13px; margin: 4px 0;"><strong>🤝 Synergy:</strong> ${data.team_analysis?.synergy_notes || 'Analysis complete.'}</p>
      ${data.team_analysis?.team_gaps ? `<p style="color: #f87171; font-size: 13px; margin: 4px 0;"><strong>⚠️ Team Gaps:</strong> ${data.team_analysis.team_gaps}</p>` : ''}
      ${data.team_analysis?.enemy_threats ? `<p style="color: #fbbf24; font-size: 13px; margin: 4px 0;"><strong>🎯 Main Threats:</strong> ${data.team_analysis.enemy_threats}</p>` : ''}
    </div>

    <!-- Recommended Build Path Grid -->
    <h4 style="color: #38bdf8;">Recommended Build Path</h4>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-bottom: 20px;">
  `;

  data.recommended_build.forEach(item => {
    html += `
      <div style="background: #0f172a; padding: 10px; border-radius: 8px; text-align: center;">
        <div style="width: 38px; height: 38px; margin: 0 auto; background: #0284c7; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px;">
          🛡️
        </div>
        <div style="font-weight: bold; font-size: 11px; margin: 6px 0 2px 0; color: #f8fafc;">${item.name}</div>
        <div style="font-size: 10px; color: #94a3b8; line-height: 1.2;">${item.reason}</div>
      </div>
    `;
  });

  html += `</div>
    <!-- Emblem & Talents Badges -->
    <h4 style="color: #38bdf8;">Emblem & Talents</h4>
    <div style="background: #0f172a; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
      <strong style="color: #38bdf8; font-size: 13px;">${data.emblem.name}</strong>
      <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
  `;

  data.emblem.talents.forEach(talent => {
    html += `
      <span style="background: #1e293b; color: #e2e8f0; border: 1px solid #38bdf8; font-size: 11px; padding: 4px 10px; border-radius: 12px; font-weight: 500;">
        ⚡ ${talent}
      </span>
    `;
  });

  html += `</div></div>
    <!-- Battle Spell Card -->
    <h4 style="color: #38bdf8;">Battle Spell</h4>
    <div style="background: #0f172a; padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 12px;">
      <div style="background: #0284c7; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px;">
        ✨
      </div>
      <div>
        <strong style="color: #f8fafc; font-size: 13px;">${data.battle_spell.name}</strong>
        <div style="font-size: 11px; color: #94a3b8;">${data.battle_spell.reason}</div>
      </div>
    </div>
  `;

  outputDiv.innerHTML = html;
}
