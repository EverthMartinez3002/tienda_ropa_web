const multer = require('multer');

function errorHandler(error, _req, res, _next) {
  console.error(error);

  if (res.headersSent) return;

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'La imagen supera el tamaño máximo permitido de 4 MB.' });
    }
    return res.status(400).json({ error: 'Solo se permiten imágenes JPG, PNG, WEBP, GIF o SVG.' });
  }

  const status = error.status || error.statusCode || 500;
  const message = status >= 500 ? 'Ocurrió un error interno.' : (error.message || 'No se pudo completar la operación.');
  return res.status(status).json({ error: message });
}

module.exports = { errorHandler };
