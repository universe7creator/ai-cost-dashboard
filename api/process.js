/**
 * AI Cost Dashboard — Cost Analysis Engine
 *
 * Accepts LLM usage data and returns:
 * - Total cost calculation
 * - Per-model breakdown
 * - Budget alert status
 * - Optimization recommendations
 * - Model cost comparisons
 */

// Current pricing (per 1M tokens) — updated 2025-2026
const PRICING = {
  openai: {
    'gpt-4o':           { input: 2.50,  output: 10.00, cached: 1.25 },
    'gpt-4o-mini':      { input: 0.15,  output: 0.60,  cached: 0.075 },
    'gpt-4-turbo':      { input: 10.00, output: 30.00, cached: 5.00 },
    'gpt-4':            { input: 30.00, output: 60.00, cached: 15.00 },
    'o1':               { input: 15.00, output: 60.00, cached: 7.50 },
    'o1-mini':          { input: 3.00,  output: 12.00, cached: 1.50 },
    'o3-mini':          { input: 1.10,  output: 4.40,  cached: 0.55 },
    'gpt-3.5-turbo':    { input: 0.50,  output: 1.50,  cached: 0.25 },
  },
  anthropic: {
    'claude-sonnet-4-20250514': { input: 3.00,  output: 15.00, cached: 0.30 },
    'claude-opus-4-20250514':   { input: 15.00, output: 75.00,  cached: 1.50 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00, cached: 0.30 },
    'claude-3-5-haiku-20241022':  { input: 0.80, output: 4.00,  cached: 0.08 },
    'claude-3-opus-20240229':     { input: 15.00, output: 75.00, cached: 1.50 },
    'claude-3-haiku-20240307':    { input: 0.25, output: 1.25,  cached: 0.025 },
  },
  google: {
    'gemini-2.5-pro':   { input: 1.25,  output: 10.00, cached: 0.125 },
    'gemini-2.5-flash': { input: 0.15,  output: 0.60,  cached: 0.015 },
    'gemini-2.0-flash': { input: 0.10,  output: 0.40,  cached: 0.01 },
  },
  groq: {
    'llama-3.3-70b':    { input: 0.59,  output: 0.79,  cached: 0 },
    'llama-3.1-8b':     { input: 0.05,  output: 0.08,  cached: 0 },
    'mixtral-8x7b':     { input: 0.27,  output: 0.27,  cached: 0 },
  }
};

// Budget tier recommendations
const BUDGET_TIERS = {
  hobby:    { monthly: 50,   label: 'Hobby' },
  startup:  { monthly: 500,  label: 'Startup' },
  team:     { monthly: 2000, label: 'Team' },
  enterprise: { monthly: 10000, label: 'Enterprise' }
};

/**
 * Calculate cost for a single model usage entry
 */
function calculateModelCost(provider, model, inputTokens, outputTokens, cachedTokens = 0) {
  const models = PRICING[provider];
  if (!models || !models[model]) {
    return null;
  }

  const pricing = models[model];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const cachedCost = (cachedTokens / 1_000_000) * pricing.cached;

  return {
    model,
    provider,
    inputTokens,
    outputTokens,
    cachedTokens,
    totalTokens: inputTokens + outputTokens + cachedTokens,
    inputCost: round(inputCost),
    outputCost: round(outputCost),
    cachedCost: round(cachedCost),
    totalCost: round(inputCost + outputCost + cachedCost),
    pricing: {
      inputPerM: pricing.input,
      outputPerM: pricing.output,
      cachedPerM: pricing.cached
    }
  };
}

/**
 * Generate optimization recommendations based on usage patterns
 */
function generateRecommendations(usageBreakdown, totalCost) {
  const recommendations = [];

  // Check if using expensive models for simple tasks
  const expensiveModels = usageBreakdown.filter(u => {
    const pricing = PRICING[u.provider]?.[u.model];
    return pricing && pricing.input >= 10;
  });

  if (expensiveModels.length > 0) {
    const models = expensiveModels.map(u => u.model).join(', ');
    recommendations.push({
      type: 'warning',
      title: 'Expensive Model Detected',
      description: `You're using premium models (${models}). Consider gpt-4o-mini or claude-3-5-haiku for simpler tasks to save up to 90%.`,
      potentialSavings: round(totalCost * 0.3)
    });
  }

  // Check caching opportunity
  const noCaching = usageBreakdown.filter(u => u.cachedTokens === 0 && u.inputTokens > 0);
  if (noCaching.length > 0) {
    recommendations.push({
      type: 'info',
      title: 'Enable Prompt Caching',
      description: 'Enable prompt caching to reduce input costs by up to 90% for repeated system prompts.',
      potentialSavings: round(usageBreakdown.reduce((sum, u) => sum + u.inputCost, 0) * 0.5)
    });
  }

  // Check for cheaper alternatives
  const hasOpenAI = usageBreakdown.some(u => u.provider === 'openai');
  const hasGroq = usageBreakdown.some(u => u.provider === 'groq');
  if (hasOpenAI && !hasGroq) {
    recommendations.push({
      type: 'tip',
      title: 'Consider Groq for Speed',
      description: 'Groq offers Llama 3.3 70B at ~80% lower cost with 10x faster inference for compatible workloads.',
      potentialSavings: round(totalCost * 0.4)
    });
  }

  // Batch processing suggestion
  if (usageBreakdown.length > 3) {
    recommendations.push({
      type: 'tip',
      title: 'Batch Your Requests',
      description: 'Combine multiple API calls into batch requests to reduce overhead and take advantage of volume pricing.',
      potentialSavings: round(totalCost * 0.1)
    });
  }

  // Budget alert
  if (totalCost > 100) {
    recommendations.push({
      type: 'alert',
      title: 'High Monthly Spend',
      description: `Your current spend of $${totalCost.toFixed(2)} is significant. Set up budget alerts to avoid surprises.`,
      potentialSavings: 0
    });
  }

  return recommendations;
}

/**
 * Generate model comparison for the same workload
 */
function generateComparison(model, inputTokens, outputTokens) {
  const comparisons = [];
  const allProviders = Object.keys(PRICING);

  for (const provider of allProviders) {
    for (const [modelName, pricing] of Object.entries(PRICING[provider])) {
      const cost = round(
        (inputTokens / 1_000_000) * pricing.input +
        (outputTokens / 1_000_000) * pricing.output
      );
      comparisons.push({
        provider,
        model: modelName,
        cost,
        inputCost: round((inputTokens / 1_000_000) * pricing.input),
        outputCost: round((outputTokens / 1_000_000) * pricing.output)
      });
    }
  }

  comparisons.sort((a, b) => a.cost - b.cost);

  // Add rank
  comparisons.forEach((c, i) => {
    c.rank = i + 1;
    c.isCheapest = i === 0;
    c.savingsVsMostExpensive = i < comparisons.length - 1
      ? round(comparisons[comparisons.length - 1].cost - c.cost)
      : 0;
  });

  return comparisons;
}

/**
 * Calculate budget alert status
 */
function calculateBudgetAlert(totalCost, monthlyBudget = null) {
  if (!monthlyBudget) {
    // Auto-detect tier
    for (const [key, tier] of Object.entries(BUDGET_TIERS)) {
      if (totalCost <= tier.monthly * 0.8) {
        return {
          tier: key,
          tierLabel: tier.label,
          budget: tier.monthly,
          spent: round(totalCost),
          remaining: round(tier.monthly - totalCost),
          percentage: round((totalCost / tier.monthly) * 100),
          status: totalCost > tier.monthly * 0.8 ? 'warning' : 'healthy',
          alert: false
        };
      }
    }
    return {
      tier: 'enterprise',
      tierLabel: 'Enterprise',
      budget: BUDGET_TIERS.enterprise.monthly,
      spent: round(totalCost),
      remaining: round(BUDGET_TIERS.enterprise.monthly - totalCost),
      percentage: round((totalCost / BUDGET_TIERS.enterprise.monthly) * 100),
      status: 'healthy',
      alert: false
    };
  }

  const percentage = (totalCost / monthlyBudget) * 100;
  let status = 'healthy';
  let alert = false;

  if (percentage >= 100) { status = 'exceeded'; alert = true; }
  else if (percentage >= 80) { status = 'warning'; alert = true; }
  else if (percentage >= 50) { status = 'moderate'; }

  return {
    tier: 'custom',
    tierLabel: 'Custom',
    budget: monthlyBudget,
    spent: round(totalCost),
    remaining: round(Math.max(0, monthlyBudget - totalCost)),
    percentage: round(percentage),
    status,
    alert
  };
}

function round(n) {
  return Math.round(n * 10000) / 10000;
}

// Main endpoint handler
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-License-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { provider, model, usage_data, usageData, budget, action } = req.body;
    const data = usage_data || usageData || req.body.data;

    // Action: single cost calculation
    if (action === 'calculate' && provider && model && data) {
      const inputTokens = data?.input_tokens || data?.inputTokens || 0;
      const outputTokens = data?.output_tokens || data?.outputTokens || 0;
      const cachedTokens = data?.cached_tokens || data?.cachedTokens || 0;

      const cost = calculateModelCost(provider, model, inputTokens, outputTokens, cachedTokens);
      if (!cost) {
        return res.status(400).json({
          error: 'Unknown model',
          message: `Model "${model}" not found for provider "${provider}"`,
          availableModels: PRICING[provider] ? Object.keys(PRICING[provider]) : Object.keys(PRICING)
        });
      }

      // Generate comparison
      const comparison = generateComparison(model, inputTokens, outputTokens);

      return res.status(200).json({
        success: true,
        cost,
        comparison: comparison.slice(0, 10), // Top 10 cheapest
        timestamp: new Date().toISOString()
      });
    }

    // Action: batch analysis
    if (action === 'analyze' && Array.isArray(data)) {
      const usageBreakdown = [];
      let totalCost = 0;

      for (const entry of data) {
        const cost = calculateModelCost(
          entry.provider, entry.model,
          entry.input_tokens || entry.inputTokens || 0,
          entry.output_tokens || entry.outputTokens || 0,
          entry.cached_tokens || entry.cachedTokens || 0
        );
        if (cost) {
          usageBreakdown.push(cost);
          totalCost += cost.totalCost;
        }
      }

      const recommendations = generateRecommendations(usageBreakdown, totalCost);
      const budgetAlert = calculateBudgetAlert(totalCost, budget);

      // Provider breakdown
      const providerBreakdown = {};
      for (const entry of usageBreakdown) {
        if (!providerBreakdown[entry.provider]) {
          providerBreakdown[entry.provider] = { totalCost: 0, models: {} };
        }
        providerBreakdown[entry.provider].totalCost += entry.totalCost;
        if (!providerBreakdown[entry.provider].models[entry.model]) {
          providerBreakdown[entry.provider].models[entry.model] = 0;
        }
        providerBreakdown[entry.provider].models[entry.model] += entry.totalCost;
      }

      // Round all provider breakdown values
      for (const p of Object.keys(providerBreakdown)) {
        providerBreakdown[p].totalCost = round(providerBreakdown[p].totalCost);
        for (const m of Object.keys(providerBreakdown[p].models)) {
          providerBreakdown[p].models[m] = round(providerBreakdown[p].models[m]);
        }
      }

      return res.status(200).json({
        success: true,
        summary: {
          totalCost: round(totalCost),
          totalEntries: usageBreakdown.length,
          totalTokens: usageBreakdown.reduce((sum, e) => sum + e.totalTokens, 0),
          avgCostPerEntry: round(totalCost / Math.max(1, usageBreakdown.length))
        },
        breakdown: usageBreakdown,
        providerBreakdown,
        budgetAlert,
        recommendations,
        timestamp: new Date().toISOString()
      });
    }

    // Action: list available models
    if (action === 'models') {
      return res.status(200).json({
        success: true,
        providers: Object.fromEntries(
          Object.entries(PRICING).map(([provider, models]) => [
            provider,
            Object.entries(models).map(([name, pricing]) => ({
              name,
              inputPerM: pricing.input,
              outputPerM: pricing.output,
              cachedPerM: pricing.cached
            }))
          ])
        )
      });
    }

    // Action: model comparison
    if (action === 'compare' && model) {
      const inputTokens = data?.input_tokens || data?.inputTokens || 1000000;
      const outputTokens = data?.output_tokens || data?.outputTokens || 1000000;
      const comparison = generateComparison(model, inputTokens, outputTokens);

      return res.status(200).json({
        success: true,
        inputTokens,
        outputTokens,
        comparison,
        cheapest: comparison[0],
        mostExpensive: comparison[comparison.length - 1],
        potentialSavings: round(comparison[comparison.length - 1].cost - comparison[0].cost),
        timestamp: new Date().toISOString()
      });
    }

    // Fallback: implicit calculate (no action but provider+model+data present)
    if (provider && model && data && !action) {
      const inputTokens = data?.input_tokens || data?.inputTokens || 0;
      const outputTokens = data?.output_tokens || data?.outputTokens || 0;
      const cachedTokens = data?.cached_tokens || data?.cachedTokens || 0;
      const cost = calculateModelCost(provider, model, inputTokens, outputTokens, cachedTokens);
      if (!cost) {
        return res.status(400).json({ error: 'Unknown model', message: `Model "${model}" not found for "${provider}"` });
      }
      const comparison = generateComparison(model, inputTokens, outputTokens);
      return res.status(200).json({ success: true, cost, comparison: comparison.slice(0, 10) });
    }

    return res.status(400).json({
      error: 'Invalid request',
      actions: ['calculate', 'analyze', 'models', 'compare'],
      example: {
        action: 'calculate',
        provider: 'openai',
        model: 'gpt-4o',
        usage_data: { input_tokens: 50000, output_tokens: 10000 }
      }
    });

  } catch (error) {
    console.error('[ERROR] AI Cost Dashboard:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
