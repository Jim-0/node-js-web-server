const { spawn } = require('child_process');
const httpModule = require('http');
const urlModule = require('url');
const test = require('tape');
const endpointURL = 'http://127.0.0.1:3000';
// Make sure the port is available when test fail with `not ok 1 plan != count`
console.log('endpointURL:', endpointURL);

// Start the app
const env = Object.assign({}, process.env, {PORT: endpointURL.split(':')[2]});
const child = spawn('node', ['index.js'], {env});

test('responds to requests', (t) => {
  t.plan(4);

  // Wait until the server is ready
  child.stdout.on('data', _ => {
    // Make a request to our app
    (async () => {
      httpModule.get(endpointURL, (res) => {
        const { statusCode } = res;
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          // stop the server
          child.kill();
          console.log('rawData:', rawData);
          // No error
          t.false(res.error);
          // Successful response
          t.equal(statusCode, 200);
          // Assert content checks
          t.notEqual(rawData.indexOf("Hello"), -1);
          t.notEqual(rawData.indexOf("World"), -1);
        });
      });
    })();
  });
});
