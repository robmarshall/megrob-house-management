import { QueueBear } from 'queuebear';

// Initialize QueueBear client
export const qb = new QueueBear({
  apiKey: process.env.QUEUEBEAR_API_KEY!,
  projectId: process.env.QUEUEBEAR_PROJECT_ID!,
});

// Get the backend URL for webhooks (used as callback destination)
export const getWebhookUrl = (path: string): string => {
  const baseUrl = process.env.QUEUEBEAR_REDIRECT_URL;
  if (!baseUrl) {
    throw new Error('QUEUEBEAR_REDIRECT_URL environment variable is not set');
  }
  return `${baseUrl}${path}`;
};
