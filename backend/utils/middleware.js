/**
 * Creates an Express middleware for validating the request body against a Zod schema.
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate against.
 * @returns {import('express').RequestHandler} Express middleware function.
 */
export const validateRequestBody = (schema) => {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validates outgoing response payload against a Zod schema.
 * Sends the validated payload or a 500 internal server error if the contract is violated.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate against.
 * @param {any} payload - The payload to send to the client.
 * @param {number} [statusCode=200] - The HTTP status code to send on success.
 */
export const sendValidatedResponse = (req, res, schema, payload, statusCode = 200) => {
  const result = schema.safeParse(payload);
  if (!result.success) {
    console.error(`[Error] [${req.requestId}] Response validation failed:`, result.error);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error: API contract violation",
      requestId: req.requestId,
    });
  }
  return res.status(statusCode).json(result.data);
};
