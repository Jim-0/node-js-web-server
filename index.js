
const expressModule = require('express')
const app = expressModule()
const fsModule = require('fs')
const PORT = process.env.PORT || 3000

let pagesMapTuples = [
  { remotePath: '/text', localPath: './views/pages/index.html' },
]

let rootPage = 'Hello World!'

pagesMapTuples.forEach(function(value, offset){
  app.get(value.remotePath, (req, res) => res.send(fsModule.readFileSync(value.localPath, {encoding: 'utf8'})))
  rootPage += `<div><a href="${ value.remotePath }">${ value.remotePath }</a></div>`
});

app.get('/', (req, res) => res.send(rootPage));

app.listen(PORT, () => console.log(`Listening on ${ PORT }`));
