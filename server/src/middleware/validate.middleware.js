export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      console.error('[validateBody] Validation failed:', JSON.stringify(result.error.flatten(), null, 2));
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: result.error.flatten(),
        },
      });
    }
    req.body = result.data;
    return next();
  };
}

