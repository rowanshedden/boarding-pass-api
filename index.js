require('dotenv').config()

const bodyParser = require('body-parser')
const express = require('express')
const http = require('http')


// Import environment variables for use via an .env file in a non-containerized context
const dotenv = require('dotenv')
dotenv.config()

let app = express()
let server = http.createServer(app)

module.exports.server = server

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

server.listen(process.env.CONTROLLERPORT || 3100, () =>
  console.log(
    `Server listening at http://localhost:${
      process.env.CONTROLLERPORT || 3100
    }`,
    `\n Agent Address: ${process.env.AGENTADDRESS || 'localhost:8150'}`,
  ),
)

app.use('/', (req, res) => {
  console.log('Request outside of normal paths', req.url)
  console.log(req.body)
  res.status(404).send()
})
