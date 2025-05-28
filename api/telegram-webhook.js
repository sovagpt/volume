// api/telegram-webhook.js
// This handles real-time Telegram updates via webhook

let latestVolumeData = null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;
    
    // Verify the update is from your channel/bot
    if (!update.message || !update.message.text) {
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    const text = message.text;

    // Check if this is a pump volume report
    if (isVolumeReport(text)) {
      const volumeData = parseVolumeReport(text);
      
      if (volumeData) {
        // Store the latest data (in production, use a database)
        latestVolumeData = {
          ...volumeData,
          timestamp: new Date(),
          messageId: message.message_id
        };

        console.log('New volume data received:', latestVolumeData);
        
        // Optionally trigger real-time updates to connected clients
        // await notifyClients(latestVolumeData);
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function isVolumeReport(text) {
  const lowerText = text.toLowerCase();
  return lowerText.includes('pump volume report') && 
         lowerText.includes('total volume:') && 
         lowerText.includes('sol');
}

function parseVolumeReport(text) {
  try {
    const data = {};

    // Enhanced parsing patterns for different message formats
    const patterns = {
      totalVolume: /Total Volume[:\s]+([\d,]+\.?\d*)\s*SOL/i,
      buyVolume: /Buy Volume[:\s]+([\d,]+\.?\d*)\s*SOL/i,
      sellVolume: /Sell Volume[:\s]+([\d,]+\.?\d*)\s*SOL/i,
      totalTrades: /Total Trades[:\s]+([\d,]+)/i,
      newCoins: /New Coins[:\s]+([\d,]+)/i,
      totalBuys: /Total Buys[:\s]+([\d,]+)/i,
      totalSells: /Total Sells[:\s]+([\d,]+)/i,
      reachedKOTH: /Reached KOTH[:\s]+([\d,]+)/i,
      fullyBonded: /Fully Bonded[:\s]+([\d,]+)/i
    };

    // Alternative patterns for different formats
    const altPatterns = {
      totalVolume: /(\d+,?\d*\.?\d*)\s*SOL.*total.*volume/i,
      buyVolume: /buy.*volume.*?(\d+,?\d*\.?\d*)\s*SOL/i,
      sellVolume: /sell.*volume.*?(\d+,?\d*\.?\d*)\s*SOL/i
    };

    // Try primary patterns first
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(value)) {
          data[key] = value;
        }
      }
    }

    // Try alternative patterns if primary didn't work
    if (!data.totalVolume) {
      for (const [key, pattern] of Object.entries(altPatterns)) {
        const match = text.match(pattern);
        if (match) {
          const value = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(value)) {
            data[key] = value;
          }
        }
      }
    }

    // Parse percentage changes if available
    const changePatterns = {
      volumeChange: /\(([+-]?\d+\.?\d*)%\)/g,
    };

    const changeMatches = [...text.matchAll(changePatterns.volumeChange)];
    if (changeMatches.length > 0) {
      data.volumeChangePercent = parseFloat(changeMatches[0][1]);
    }

    // Validate essential data
    if (!data.totalVolume) {
      console.error('Could not parse total volume from:', text);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error parsing volume report:', error);
    return null;
  }
}

// Export function to get latest data (used by telegram-data.js)
export function getLatestVolumeData() {
  return latestVolumeData;
}

// Function to store data (in production, use Redis/Database)
export function setLatestVolumeData(data) {
  latestVolumeData = data;
}