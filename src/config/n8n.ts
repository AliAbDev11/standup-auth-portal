export const N8N_CONFIG = {
  webhookUrl: import.meta.env.VITE_N8N_WEBHOOK_URL || '',
  enabled: !!import.meta.env.VITE_N8N_WEBHOOK_URL,
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 2000 // 2 seconds between retries
};

export const triggerWebhookWithRetry = async (payload: any, attempt = 1): Promise<any> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), N8N_CONFIG.timeout);

    const response = await fetch(N8N_CONFIG.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json().catch(() => ({}));

  } catch (error) {
    console.error(`Webhook attempt ${attempt} failed:`, error);

    // Retry logic
    if (attempt < N8N_CONFIG.retryAttempts) {
      console.log(`Retrying in ${N8N_CONFIG.retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, N8N_CONFIG.retryDelay));
      return triggerWebhookWithRetry(payload, attempt + 1);
    }

    // All retries failed
    throw new Error(`Webhook failed after ${N8N_CONFIG.retryAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
