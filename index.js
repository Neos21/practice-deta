const express = require('express');
const serveFavicon = require('serve-favicon');

const app = express();

// For POST JSON
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// HTML
app.get('/', (req, res) => {
  console.log(`${new Date().toISOString()} [GET ] [/]  Query : [${JSON.stringify(req.query)}]`);
  res.sendFile(`${__dirname}/index.html`);
});
app.get('/index.html', (req, res) => {
  console.log(`${new Date().toISOString()} [GET ] [/index.html]  Query : [${JSON.stringify(req.query)}]`);
  res.sendFile(`${__dirname}/index.html`);
});

// Favicon
app.use(serveFavicon(`${__dirname}/favicon.ico`));

// API
app.post('/', (req, res) => {
  console.log(`${new Date().toISOString()} [POST] [/]  Param : [${JSON.stringify(req.body)}]`);
  res.json({
    myResponse: 'My Response!',
    myRequestBody: req.body
  });
});

// For 404
app.use(function(req, res, _next) {
  console.warn(`${new Date().toISOString()} [404] [${req.url}]`);
  res.status(404).send('[404] Not Found');
});

// For 500
app.use((error, req, res, _next) => {
  console.error(`${new Date().toISOString()} [500] [${req.url}]  Error : [${error.toString()}]  Stack :\n${error.stack}`);
  res.status(500).send('[500] Internal Server Error');
});

// Deta Micros では `app.listen()` しない : https://docs.deta.sh/docs/micros/deploy
module.exports = app;
