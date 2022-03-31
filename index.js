
const expressModule = require('express')
const app = expressModule()

const httpsModule = require('https');
const httpsProxyAgentModule = require('https-proxy-agent');

const fsModule = require('fs');
const PORT = process.env.PORT || 3000
const HTTPS_PROXY = process.env.HTTPS_PROXY
const GET_SECRET = process.env.GET_SECRET || 'url'
const getPrefixPath = `/get?q=${GET_SECRET}:`

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

pagesMap.forEach(function (value, offset) {
  app.get(value.remotePath, (req, res) => res.send(fsModule.readFileSync(value.localPath, { encoding: 'utf8' })))
  rootPage += `<div><a href="${value.remotePath}">${value.remotePath}</a></div>`
});

app.get('/', (req, res) => res.send(rootPage));
// app.get('/', (req, res) => res.redirect('./text'));

const sessionManager = {
  _clientChannels: [],
  addChannel(request, response) {
    this._clientChannels.push({ req: request, res: response })
  },
  sent: [],
  unsent: [],
  get pop() {
    if (this.unsent.length == 0) { return null }
    const msgString = this.unsent.shift();
    this.sent.push(msgString);
    return msgString;
  },
  get wirtableDest() {
    const currentQueue = this;
    // MARK: simple implementation of `stream.Writable`
    return {
      on() { },
      once() { },
      emit() { },
      write(data) {
        let string = Buffer.from(data).toString();
        currentQueue.unsent.push(string);
        console.log('write', string);
      },
      end() { },
    }
  },
  _syncInterval: 30,
  _intervalID: null,
  set syncInterval(milliseconds) {
    this._syncInterval = milliseconds;
    clearInterval(this._intervalID);
    let rootObj = this
    this._intervalID = setInterval(async () => {
      rootObj.scansAllChannels();
    }, milliseconds);
  },
  scansAllChannels() {
    const unsentMsg = this.pop;
    if (null == unsentMsg) { return }
    this._clientChannels.forEach((clientChannel, offset) => {
      const req = clientChannel.req;
      const res = clientChannel.res;
      console.assert((res.connection.readable == res.connection.writable), 'Unexpected case!\n');
      if (!res.connection.readable) { return }
      console.log('clientChannel.req:', offset, req.url);
      console.log('writing ' + unsentMsg);
      res.write('data: ' + unsentMsg + '\n\n');
      // res.write('id: 0\ntype: ping\ndata: ' + `{"now": "${(new Date()).toISOString()}"}` + '\n\n');
    });
  },
  run() {
    this.syncInterval = this._syncInterval;
  },
}

sessionManager.run();

app.get('/[0-9A-Za-z]{16}', (req, res) => {
  console.log('get():', req.headers, req.url);
  switch (req.headers.accept) {
    case 'text/event-stream':
      console.log('event-stream');
      res.setHeader("Content-Type", "text/event-stream");
      sessionManager.addChannel(req, res)
      break;
    default:
      console.log('req.headers.accept:', req.headers.accept);
      // res.send(fsModule.readFileSync('./public/webhooks.html', { encoding: 'utf8' }));
      res.send(rootPage);
  }
});

app.post('/[0-9A-Za-z]{16}', (req, res) => {
  console.log('post():', req.headers, req.path);
  req.pipe(sessionManager.wirtableDest);
  req.pipe(res);
});


app.listen(PORT, () => console.log(`Listening on ${PORT}`));
