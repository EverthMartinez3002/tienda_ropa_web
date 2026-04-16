function errorHandler(error, _req, res, _next) {
  console.error(error);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Ocurrió un error interno.' });
}

module.exports = { errorHandler };
