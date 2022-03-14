
// refer: https://www.expressModulejs.com.cn/starter/hello-world.html

const expressModule = require('express')
const PORT = process.env.PORT || 3000

expressModule()
  .get('/', (req, res) => res.send('Hello World!'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))
