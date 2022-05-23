
const expressModule = require('express');
const corsModule = require('cors');
const corsOptions = {
  origin: '*',
  // origin: function (origin, callback) {
  //   const whitelist = ['http://localhost:3000'];
  //   if (whitelist.includes(origin)) {
  //     callback(null, true)
  //   } else {
  //     callback(new Error('Not allowed by CORS'))
  //   }
  // },
  optionsSuccessStatus: 200
};

const app = expressModule();
// app.use(corsModule());

const httpModule = require('http');
const httpsModule = require('https');
const httpProxyAgentModule = require('http-proxy-agent');
const httpsProxyAgentModule = require('https-proxy-agent');

const fsModule = require('fs');
const PORT = process.env.PORT || 8080;
const HTTPS_PROXY = process.env.HTTPS_PROXY;
const GET_SECRET = process.env.GET_SECRET || 'url';
const getPrefixPath = `/get?q=${GET_SECRET}:`;

async function fetch(url = 'https://httpbin.org/anything', options = { headers: {}, method: 'GET', body: '' }, callback = () => { }) {
  let [http, httpProxyAgent] = [httpModule, httpProxyAgentModule];
  if (url.startsWith('https://')) {
    [http, httpProxyAgent] = [httpsModule, httpsProxyAgentModule];
  };
  // options.rejectUnauthorized = false;
  if (null != HTTPS_PROXY) {
    console.log('HTTPS_PROXY:', HTTPS_PROXY);
    let agent = new httpProxyAgent(HTTPS_PROXY);
    options.agent = agent;
  };
  return new Promise(function (resolve, reject) {
    const postData = options.body || '';
    console.assert(typeof postData === 'string', "Unexpected case!\n");
    console.log('postData:', JSON.stringify([postData]).slice(1, -1));
    delete options.body;
    const req = http.request(url, options, (res) => {
      callback(res);
      const { statusCode } = res;
      if (![200, 201, 202, 300, 301, 302].includes(statusCode)) {
        const error = new Error('Request Failed.\n' + `Status Code: ${statusCode}`);
        reject(error);
        // Consume response data to free up memory
        res.resume();
        return;
      };
      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk });
      res.on('end', () => { resolve(rawData) });
    });
    req.write(postData);
    req.end();
  });
};

// ???: Is it possible to result in a dead cycle?
app.get('/get', (req, res) => {
  if (!req.url.startsWith(getPrefixPath)) { return }
  let trustedURL = req.url.substring(getPrefixPath.length)
  fetch(trustedURL, { method: 'GET' }, (response) => { response.pipe(res) });
});

let pagesMap = [
  { remotePath: '/text', localPath: './views/pages/index.html' },
  { remotePath: '/public/main.min.js', localPath: './smee.io/public/main.min.js' },
  { remotePath: '/public/main.min.css', localPath: './smee.io/public/main.min.css' },
]

let rootPage = 'Hello World!'

pagesMap.forEach(function (value, offset) {
  app.get(value.remotePath, (req, res) => {
    res.write(fsModule.readFileSync(value.localPath, { encoding: 'utf8' }));
    res.end();
  });
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
  loadDataFromRequest(req, shouldBePacked = true) {
    const currentQueue = this;
    const writableDest = {
      receivingBuffer: null,
      on() { },
      once() { },
      emit() { },
      write(data) {
        // console.log('writableDest.write()', data);
        if (null == this.receivingBuffer) {
          this.receivingBuffer = data;
          return;
        }
        this.receivingBuffer += data;
      },
      end() {
        console.log('writableDest.end()');
        if (null == this.receivingBuffer) {
          // the lenght of posted data is `0`;
          this.receivingBuffer = '';
        }
        let string = Buffer.from(this.receivingBuffer).toString().split('\r').join('').split('\n').join('');
        console.log('writableDest.end()', string);
        // TODO: implement whitelist or blacklist
        if (shouldBePacked) {
          const packingData = req.headers;
          const addingKeys = ['body', 'query', 'timestamp'];
          addingKeys.forEach((addingKey) => {
            console.assert(!packingData.hasOwnProperty(addingKey), 'Unexpected case!\n');
          });
          packingData.query = req.query;
          packingData.timestamp = +(new Date());
          try {
            packingData.body = JSON.parse(string);
          } catch {
            packingData.body = {};
          }
          string = JSON.stringify(packingData);
        }
        currentQueue.unsent.push(string);
        currentQueue.scansAllChannels();
      },
    };
    // MARK: alternatives for Writable obj
    // let rawData = '';
    // req.on('data', (chunk) => { rawData += chunk; });
    // req.on('end', () => {
    //   try {
    //     const parsedData = rawData;
    //     console.log(parsedData);
    //     writableDest.receivingBuffer = '{}';
    //     writableDest.end();
    //   } catch (e) {
    //     console.error(e.message);
    //   }
    // });
    req.pipe(writableDest);
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
    const eventData = this.pop;
    if (null == eventData) { return }
    console.log('writingData:', eventData);
    this._clientChannels.forEach(async (clientChannel, offset) => {
      const req = clientChannel.req;
      const res = clientChannel.res;
      console.assert((res.connection.readable == res.connection.writable), 'Unexpected case!\n');
      if (!res.connection.readable) { return }
      console.log('written active client req:', offset, req.url);

      res.write('data: ' + eventData + '\n\n');
      // res.write('event: ping\nid: 0\nretry: 10000\ndata: ' + `{"now": "${(new Date()).toISOString()}"}` + '\n\n');
    });
  },
  run() {
    this.syncInterval = this._syncInterval;
  },
}

sessionManager.run();

app.get('/[0-9A-Za-z]{16}', corsModule(corsOptions), (req, res) => {
  console.log('get():', req.url);
  switch (req.headers.accept) {
    case 'text/event-stream':
      console.log('event-stream', req.headers);
      res.setHeader("Content-Type", "text/event-stream");
      sessionManager.addChannel(req, res)
      break;
    default:
      // res.setHeader("X-Frame-Options", "sameorigin");
      res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
      console.log('req.headers.accept:', req.headers.accept);
      const webhooksPage = fsModule.readFileSync('./smee.io/webhooks.html', { encoding: 'utf8' });
      res.send(webhooksPage);
  }
});

app.options('/[0-9A-Za-z]{16}', corsModule(corsOptions));
app.post('/[0-9A-Za-z]{16}', corsModule(corsOptions), (req, res, next) => {
  console.log('post():', req.url);
  sessionManager.loadDataFromRequest(req);
  res.end();
});


app.listen(PORT, () => console.log(`Listening on ${PORT}`));
