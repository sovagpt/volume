// api/telegram-data.js
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get latest Telegram data from your bot/channel
    const telegramData = await fetchLatestTelegramData();
    
    if (!telegramData) {
      return res.status(404).json({ error: 'No data available' });
    }

    res.status(200).json(telegramData);
  } catch (error) {
    console.error('Error fetching Telegram data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function fetchLatestTelegramData() {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
    throw new Error('Missing Telegram configuration');
  }

  try {
    // Get latest messages from the channel
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=10&offset=-10`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch Telegram messages');
    }

    const data = await response.json();
    const messages = data.result;

    // Find the most recent pump volume report
    const volumeReport = findLatestVolumeReport(messages);
    
    if (volumeReport) {
      return parseVolumeReport(volumeReport.message.text);
    }

    return null;
  } catch (error) {
    console.error('Telegram API error:', error);
    throw error;
  }
}

function findLatestVolumeReport(messages) {
  // Filter messages for volume reports from your channel
  const volumeReports = messages.filter(update => {
    const message = update.message;
    if (!message || !message.text) return false;
    
    // Check if message contains pump volume report indicators
    const text = message.text.toLowerCase();
    return text.includes('pump volume report') && 
           text.includes('total volume:') && 
           text.includes('sol');
  });

  // Return the most recent report
  return volumeReports.length > 0 ? volumeReports[volumeReports.length - 1] : null;
}

function parseVolumeReport(text) {
  try {
    // Parse the Telegram message format you showed
    const lines = text.split('\n');
    const data = {};

    // Extract numeric values using regex patterns
    const patterns = {
      totalVolume: /Total Volume:\s*([\d,]+\.?\d*)\s*SOL/i,
      buyVolume: /Buy Volume:\s*([\d,]+\.?\d*)\s*SOL/i,
      sellVolume: /Sell Volume:\s*([\d,]+\.?\d*)\s*SOL/i,
      totalTrades: /Total Trades:\s*([\d,]+)/i,
      newCoins: /New Coins:\s*([\d,]+)/i,
      totalBuys: /Total Buys:\s*([\d,]+)/i,
      totalSells: /Total Sells:\s*([\d,]+)/i,
      reachedKOTH: /Reached KOTH:\s*([\d,]+)/i,
      fullyBonded: /Fully Bonded:\s*([\d,]+)/i
    };

    // Extract each value
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        // Remove commas and convert to number
        const value = parseFloat(match[1].replace(/,/g, ''));
        data[key] = value;
      }
    }

    // Validate that we have essential data
    if (!data.totalVolume || !data.totalTrades) {
      throw new Error('Invalid volume report format');
    }

    return data;
  } catch (error) {
    console.error('Error parsing volume report:', error);
    throw new Error('Failed to parse volume report');
  }
}

// Alternative webhook method for real-time updates
async function setupTelegramWebhook() {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const WEBHOOK_URL = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}/api/telegram-webhook`
    : process.env.WEBHOOK_URL;

  if (!TELEGRAM_BOT_TOKEN || !WEBHOOK_URL) {
    console.error('Missing webhook configuration');
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          allowed_updates: ['message']
        })
      }
    );

    const result = await response.json();
    console.log('Webhook setup result:', result);
  } catch (error) {
    console.error('Failed to setup webhook:', error);
  }
}
