const { spawn } = require('child_process');
const got = require('got');
const test = require('tape');
const endpointURL = 'http://127.0.0.1:3000';
const GET_SECRET = process.env.GET_SECRET || 'url'
const testGetURL = endpointURL+`/get?q=${ GET_SECRET }:https://httpbin.org/get`

// Make sure the port is available when test fail with `not ok 1 plan != count`
console.log('endpointURL:', endpointURL);

// Start the app
const env = Object.assign({}, process.env, {PORT: endpointURL.split(':')[2]});
const child = spawn('node', ['index.js'], {env});

test('responds to requests', (t) => {
  t.plan(6);

  var repeatTime = 0;
  // Wait until the server is ready
  child.stdout.on('data', _ => {
    // Make a request to our app
    (async () => {
      if (repeatTime++>0) { return }
      const response = await got(endpointURL);
      // test delegate method to get resource
      const response1 = await got(testGetURL);
      // stop the server
      child.kill();
      // No error
      t.false(response.error);
      t.false(response1.error);
      // Successful response
      t.equal(response.statusCode, 200);
      t.equal(response1.statusCode, 200);
      // Assert content checks
      t.notEqual(response.body.indexOf("Hello"), -1);
      t.notEqual(response.body.indexOf("World"), -1);
      console.log('response.body', response1.body)
    })();
  });
});
