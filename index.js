
const expressModule = require('express')
const app = expressModule()

const httpsModule = require('https');
const httpsProxyAgentModule = require('https-proxy-agent');

const fsModule = require('fs')
const PORT = process.env.PORT || 3000
const HTTPS_PROXY = process.env.HTTPS_PROXY
const GET_SECRET = process.env.GET_SECRET || 'url'

function getResource(onURL, callBack) {
  let options = {}
  if (null != HTTPS_PROXY) {
    console.log('HTTPS_PROXY:', HTTPS_PROXY)
    let agent = new httpsProxyAgentModule(HTTPS_PROXY);
    options.agent = agent;
  }
  httpsModule.get(onURL, options, (res) => { callBack(res) });
}

// ???: Is it possible to result in a dead cycle?
app.get('/get', (req, res) => {
  const prefix = `/get?q=${ GET_SECRET }:`
  if (!req.url.startsWith(prefix)) { return }
  let trustedURL = req.url.substring(prefix.length)
  getResource(trustedURL, (response) => { response.pipe(res) })
});

let pagesMap = [
  { remotePath: '/text', localPath: './views/pages/index.html' },
]

let rootPage = 'Hello World!'

pagesMap.forEach(function(value, offset){
  app.get(value.remotePath, (req, res) => res.send(fsModule.readFileSync(value.localPath, {encoding: 'utf8'})))
  rootPage += `<div><a href="${ value.remotePath }">${ value.remotePath }</a></div>`
});

app.get('/', (req, res) => res.send(rootPage));

app.listen(PORT, () => console.log(`Listening on ${ PORT }`));
