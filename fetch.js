
const HTTPS_PROXY = process.env.HTTPS_PROXY;
// const urlModule = require('url');
const httpModule = require('http');
const httpsModule = require('https');
const httpProxyAgentModule = require('http-proxy-agent');
const httpsProxyAgentModule = require('https-proxy-agent');

// !!!: the `node-fetch/node-fetch` is available, but not easy to configure proxy
// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function fetch(url,
  { proxyURI = fetch.PROXY_URI || HTTPS_PROXY, method = 'get', headers = {}, body } = {},
  onresponse = _ => { }) {
  let [http, httpProxyAgent] = [httpModule, httpProxyAgentModule];
  if (url.startsWith('https://')) {
    [http, httpProxyAgent] = [httpsModule, httpsProxyAgentModule];
  };
  const options = { method: method, headers: headers };
  // options.rejectUnauthorized = false;
  if (null != proxyURI) {
    console.log('proxyURI:', proxyURI);
    let agent = new httpProxyAgent(proxyURI);
    options.agent = agent;
  };
  return new Promise(function (resolve, reject) {
    const req = http.request(url, options, (res) => {
      onresponse(res);
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
    // console.log('body:', JSON.stringify([body]).slice(1, -1));
    if (typeof body === 'string') { req.write(body) };
    req.end();
  });
};

exports.fetch = fetch;

