
const expressModule = require('express')
const app = expressModule()

const httpsModule = require('https');
const httpsProxyAgentModule = require('https-proxy-agent');

const fsModule = require('fs')
const PORT = process.env.PORT || 3000
const HTTPS_PROXY = process.env.HTTPS_PROXY
const GET_SECRET = process.env.GET_SECRET || 'url'
const getPrefixPath = `/get?q=${ GET_SECRET }:`

function getResource(onURL, callBack) {
  // TODO: get resouce by `HTTP`
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
  // TODO: deliver request header
  if (!req.url.startsWith(getPrefixPath)) { return }
  let trustedURL = req.url.substring(getPrefixPath.length)
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
// app.get('/', (req, res) => res.redirect('./text'));

app.listen(PORT, () => console.log(`Listening on ${ PORT }`));
