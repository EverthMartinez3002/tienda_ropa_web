function ensureReady(readyPromise) {
  return async (_req, _res, next) => {
    try {
      await readyPromise;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { ensureReady };
