/** Contract-shaped error helpers. */

export function err(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

/** Create an Error carrying an HTTP status + contract error code. */
export function httpError(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

export function paginate(req, def = 20, max = 100) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(max, Math.max(1, Number.parseInt(req.query.limit, 10) || def));
  return { page, limit, offset: (page - 1) * limit };
}

export function pageEnvelope(total, page, limit) {
  return { pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
