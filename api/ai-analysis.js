// api/ai-analysis.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'AI service not configured' });
  }

  try {
    const { query, currentData, previousData, hourlyData } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Build context from volume data
    const dataContext = buildDataContext(currentData, previousData, hourlyData);
    
    // Call Anthropic API
    const aiResponse = await callAnthropicAPI(query, dataContext, ANTHROPIC_API_KEY);
    
    res.status(200).json({ response: aiResponse });
  } catch (error) {
    console.error('AI Analysis error:', error);
    res.status(500).json({ error: 'AI analysis failed' });
  }
}

function buildDataContext(currentData, previousData, hourlyData) {
  let context = "Pump.fun Volume Analytics Data:\n\n";

  // Current data
  if (currentData && currentData.totalVolume) {
    context += "CURRENT PERIOD:\n";
    context += `• Total Volume: ${currentData.totalVolume.toFixed(2)} SOL\n`;
    context += `• Buy Volume: ${currentData.buyVolume?.toFixed(2) || 'N/A'} SOL\n`;
    context += `• Sell Volume: ${currentData.sellVolume?.toFixed(2) || 'N/A'} SOL\n`;
    context += `• Total Trades: ${currentData.totalTrades?.toLocaleString() || 'N/A'}\n`;
    context += `• New Coins: ${currentData.newCoins?.toLocaleString() || 'N/A'}\n`;
    context += `• Total Buys: ${currentData.totalBuys?.toLocaleString() || 'N/A'}\n`;
    context += `• Total Sells: ${currentData.totalSells?.toLocaleString() || 'N/A'}\n`;
    context += `• Reached KOTH: ${currentData.reachedKOTH || 'N/A'}\n`;
    context += `• Fully Bonded: ${currentData.fullyBonded || 'N/A'}\n`;
    
    if (currentData.timestamp) {
      context += `• Last Updated: ${new Date(currentData.timestamp).toLocaleString()}\n`;
    }
    context += "\n";
  }

  // Previous period comparison
  if (previousData && previousData.totalVolume) {
    context += "PREVIOUS PERIOD:\n";
    context += `• Total Volume: ${previousData.totalVolume.toFixed(2)} SOL\n`;
    context += `• Total Trades: ${previousData.totalTrades?.toLocaleString() || 'N/A'}\n`;
    context += `• New Coins: ${previousData.newCoins?.toLocaleString() || 'N/A'}\n`;
    
    // Calculate changes
    if (currentData && currentData.totalVolume) {
      const volumeChange = ((currentData.totalVolume - previousData.totalVolume) / previousData.totalVolume * 100).toFixed(2);
      const tradesChange = currentData.totalTrades && previousData.totalTrades ? 
        ((currentData.totalTrades - previousData.totalTrades) / previousData.totalTrades * 100).toFixed(2) : 'N/A';
      
      context += `\nCHANGES:\n`;
      context += `• Volume Change: ${volumeChange}%\n`;
      context += `• Trades Change: ${tradesChange}%\n`;
    }
    context += "\n";
  }

  // Hourly trend data
  if (hourlyData && hourlyData.length > 0) {
    context += "HOURLY TRENDS (Last 24 hours):\n";
    const recentHours = hourlyData.slice(-6); // Last 6 hours
    recentHours.forEach(hour => {
      context += `• ${hour.time}: ${hour.volume?.toFixed(0) || 'N/A'} SOL, ${hour.trades || 'N/A'} trades\n`;
    });
    
    // Calculate trend direction
    if (hourlyData.length >= 2) {
      const recent = hourlyData[hourlyData.length - 1];
      const previous = hourlyData[hourlyData.length - 2];
      const trend = recent.volume > previous.volume ? 'increasing' : 'decreasing';
      context += `• Recent Trend: Volume is ${trend}\n`;
    }
    context += "\n";
  }

  // Market analysis context
  context += "ANALYSIS CONTEXT:\n";
  context += "• pump.fun is a Solana-based token launch platform\n";
  context += "• KOTH = King of the Hill (successful token launches)\n";
  context += "• Fully Bonded = Tokens that reached full liquidity bonding\n";
  context += "• Higher buy/sell ratios indicate bullish sentiment\n";
  context += "• Volume trends indicate market activity and interest\n\n";

  return context;
}

async function callAnthropicAPI(query, dataContext, apiKey) {
  const prompt = `${dataContext}

USER QUERY: ${query}

Please provide a helpful analysis based on the pump.fun volume data above. Be specific with numbers when relevant, identify trends, and give actionable insights. Keep responses concise but informative.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', response.status, errorData);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw error;
  }
}

// Predefined analysis functions for common queries
export function generateTrendAnalysis(currentData, previousData, hourlyData) {
  if (!currentData || !previousData) return "Insufficient data for trend analysis";

  const volumeChange = ((currentData.totalVolume - previousData.totalVolume) / previousData.totalVolume * 100).toFixed(2);
  const tradesChange = ((currentData.totalTrades - previousData.totalTrades) / previousData.totalTrades * 100).toFixed(2);
  
  let analysis = `Volume Trend Analysis:\n`;
  analysis += `• Volume ${volumeChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(volumeChange)}%\n`;
  analysis += `• Trading activity ${tradesChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(tradesChange)}%\n`;
  
  if (currentData.buyVolume && currentData.sellVolume) {
    const buyRatio = (currentData.buyVolume / (currentData.buyVolume + currentData.sellVolume) * 100).toFixed(1);
    analysis += `• Buy pressure: ${buyRatio}% (${buyRatio > 50 ? 'Bullish' : 'Bearish'})\n`;
  }

  return analysis;
}

export function generateMarketSummary(currentData) {
  if (!currentData) return "No current market data available";

  let summary = `Market Summary:\n`;
  summary += `• Total Volume: ${currentData.totalVolume?.toFixed(2)} SOL\n`;
  summary += `• Active Trading: ${currentData.totalTrades?.toLocaleString()} trades\n`;
  summary += `• New Launches: ${currentData.newCoins?.toLocaleString()} tokens\n`;
  
  if (currentData.reachedKOTH && currentData.newCoins) {
    const successRate = (currentData.reachedKOTH / currentData.newCoins * 100).toFixed(1);
    summary += `• Success Rate: ${successRate}% reached KOTH\n`;
  }

  return summary;
}