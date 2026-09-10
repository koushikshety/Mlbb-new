window.addEventListener('DOMContentLoaded', () => {
  const savedKey = localStorage.getItem('mlbb_gemini_key');
  if (savedKey) {
    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) apiKeyInput.value = savedKey;
  }
});

const SYSTEM_PROMPT = `
You are an expert Mobile Legends: Bang Bang (MLBB) Draft Analyzer.
Analyze the 5v5 draft from the provided image or text input.

Constraint Guidelines:
1. Carefully identify the exact 5 allied heroes and 5 enemy heroes shown in the draft screen before analyzing. Do NOT guess or hallucinate heroes that are not present.
2. Identify team synergy, team gaps, and main enemy threats concisely.
3. Recommend exactly 6 build items, 3 emblem talents, and 1 battle spell.
4. Item names MUST match standard MLBB nomenclature (e.g., "Demon Hunter Sword", "Tough Boots", "Corrosion Scythe", "Windtalker").
5. Reasons must be ultra-concise (under 8 words).

Return strictly JSON format adhering to this structure:
{
  "team_analysis": {
    "synergy_notes": "Short synergy summary.",
    "team_gaps": "Main team gaps.",
    "enemy_threats": "Key enemy threats."
  },
  "recommended_build": [
    {"name": "Item Name", "reason": "Short reason"}
  ],
  "emblem": {
    "name": "Emblem Set Name",
    "talents": ["Talent 1", "Talent 2", "Talent 3"]
  },
  "battle_spell": {
    "name": "Spell Name",
    "reason": "Short reason"
  }
}
`;

function processAndResizeImage(file, maxDimension = 1280) {
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

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
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

// Dynamically query Fandom MediaWiki API for absolute CDN image target
async function fetchFandomImageUrl(itemName) {
  const formattedName = itemName.trim().replace(/\s+/g, '_');
  const fileName = `File:${formattedName}.png`;
  const apiUrl = `https://mobile-legends.fandom.com/api.php?action=query&titles=${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url&format=json&origin=*`;

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;
    
    const pageId = Object.keys(pages)[0];

    if (pageId !== "-1" && pages[pageId].imageinfo?.[0]?.url) {
      return pages[pageId].imageinfo[0].url;
    }
  } catch (err) {
    console.error("Failed image resolution for:", itemName, err);
  }
  return null;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  if (resultCard) resultCard.style.display = 'block';
  outputDiv.innerHTML = '<p style="color: #38bdf8;">Optimizing screenshot & analyzing draft...</p>';

  try {
    const contents = [{
      parts: [{ text: `Playing Hero: ${hero}. Analyze team synergy, identify counters based ONLY on the actual heroes in the image, and generate optimal item build.` }]
    }];

    if (fileInput && fileInput.files.length > 0) {
      const optimizedImage = await processAndResizeImage(fileInput.files[0], 1280);
      contents[0].parts.push(optimizedImage);
    }

    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    let data = null;
    let lastError = null;

    for (const model of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          if (attempt > 1) {
            outputDiv.innerHTML = `<p style="color: #fbbf24;">Retrying request on ${model}...</p>`;
            await delay(1200);
          }

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: contents,
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.15,
                maxOutputTokens: 1500
              }
            })
          });

          const resData = await response.json();

          if (response.status === 503 || response.status === 429) {
            lastError = resData;
            continue;
          }

          if (!response.ok) {
            lastError = resData;
            break;
          }

          data = resData;
          break;
        } catch (err) {
          lastError = err;
        }
      }
      if (data) break;
    }

    if (!data) {
      const msg = lastError?.error?.message || lastError?.message || JSON.stringify(lastError) || "Service unavailable.";
      throw new Error(msg);
    }

    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const result = JSON.parse(rawText);
    await renderResults(result);

  } catch (error) {
    outputDiv.innerHTML = `<p style="color: #ef4444;">Error: ${error.message}</p>`;
  }
});

async function renderResults(data) {
  const outputDiv = document.getElementById('output');

  let html = `
    <div style="background: #0f172a; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
      <h4 style="margin-top:0; color: #38bdf8;">Strategic Analysis</h4>
      <p style="color: #cbd5e1; font-size: 13px; margin: 4px 0;"><strong>🤝 Synergy:</strong> ${data.team_analysis?.synergy_notes || 'Complete'}</p>
      ${data.team_analysis?.team_gaps ? `<p style="color: #f87171; font-size: 13px; margin: 4px 0;"><strong>⚠️ Team Gaps:</strong> ${data.team_analysis.team_gaps}</p>` : ''}
      ${data.team_analysis?.enemy_threats ? `<p style="color: #fbbf24; font-size: 13px; margin: 4px 0;"><strong>🎯 Main Threats:</strong> ${data.team_analysis.enemy_threats}</p>` : ''}
    </div>

    <h4 style="color: #38bdf8;">Recommended Build Path</h4>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-bottom: 20px;">
  `;

  if (Array.isArray(data.recommended_build)) {
    const buildItemsWithUrls = await Promise.all(
      data.recommended_build.map(async (item) => {
        const url = await fetchFandomImageUrl(item.name);
        return { ...item, url };
      })
    );

    buildItemsWithUrls.forEach(item => {
      const imgContent = item.url 
        ? `<img src="${item.url}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='🛡️';">`
        : `🛡️`;

      html += `
        <div style="background: #0f172a; padding: 10px; border-radius: 8px; text-align: center;">
          <div style="width: 44px; height: 44px; margin: 0 auto; border-radius: 8px; overflow: hidden; background: #1e293b; display: flex; align-items: center; justify-content: center; border: 1px solid #38bdf8;">
            ${imgContent}
          </div>
          <div style="font-weight: bold; font-size: 11px; margin: 6px 0 2px 0; color: #f8fafc;">${item.name}</div>
          <div style="font-size: 10px; color: #94a3b8; line-height: 1.2;">${item.reason}</div>
        </div>
      `;
    });
  }

  html += `</div>
    <h4 style="color: #38bdf8;">Emblem & Talents</h4>
    <div style="background: #0f172a; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
      <strong style="color: #38bdf8; font-size: 13px;">${data.emblem?.name || 'Custom Emblem'}</strong>
      <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
  `;

  if (Array.isArray(data.emblem?.talents)) {
    data.emblem.talents.forEach(talent => {
      html += `
        <span style="background: #1e293b; color: #e2e8f0; border: 1px solid #38bdf8; font-size: 11px; padding: 4px 10px; border-radius: 12px; font-weight: 500; display: inline-flex; align-items: center;">
          ⚡ ${talent}
        </span>
      `;
    });
  }

  html += `</div></div>
    <h4 style="color: #38bdf8;">Battle Spell</h4>
    <div style="background: #0f172a; padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 12px;">
      <div style="background: #0284c7; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px;">
        ✨
      </div>
      <div>
        <strong style="color: #f8fafc; font-size: 13px;">${data.battle_spell?.name || 'Execute'}</strong>
        <div style="font-size: 11px; color: #94a3b8;">${data.battle_spell?.reason || ''}</div>
      </div>
    </div>
  `;

  outputDiv.innerHTML = html;
}
