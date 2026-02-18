import serverless from 'serverless-http';

let handler;

try {
  const { default: app } = await import('../../index.js');
  handler = serverless(app);
} catch (err) {
  console.error('[Netlify Function] Failed to initialize Express app:', err);
  handler = async () => ({
    statusCode: 500,
    body: JSON.stringify({
      error: 'Function initialization failed',
      message: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export { handler };
