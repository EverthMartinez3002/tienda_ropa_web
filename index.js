const app = require('./server');

const PORT = Number(process.env.PORT || 3000);

app.locals.ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor listo en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('No se pudo iniciar la aplicación.', error);
    process.exit(1);
  });
