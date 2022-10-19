require('dotenv').config()

const Axios = require('axios')
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

//(AmmonBurgi) Set server timeout to support the prolonged requests on verification.
server.setTimeout(1000 * 60 * 35)

// app.post('/api/credentials', (req, res) => {
//   const credentialData = req.body

//   Axios({
//       method: 'POST',
//       url: `${process.env.GOVERNMENT_API}/api/credentials`,
//       data: credentialData,
//       headers: {
//         "x-api-key": process.env.GOVERNMENT_APIKEY
//       },
//     }).then(credResponse => {
//       if (credResponse.data.success) {
//         res.status(200).send({message: credResponse.data.success})
//       } else {
//         res.status(401).json({message: 'Trusted Traveler failed to issue!', error: ''})
//       }
//     }).catch(err => {
//       console.error(err)
//       res.status(500).json({message: 'Credentials issuance failed!', error: err})
//     })
// })

app.post('/api/verifications', async (req, res) => {
  const data = req.body
  const verificationData = {
    connection_id: data.connection_id,
    contact_id: data.contact_id,
    invitation_id: data.invitation_id,
    schema_id: process.env.SCHEMA_DTC_TYPE1_IDENTITY,
    schema_attributes: [
      "created-date",
      "document-type",
      "issue-date",
      "document-number",
      "issuing-state",
      "gender",
      "date-of-birth",
      "chip-photo",
      "family-name",
      "given-names",
      "dtc",
      "upk",
      "expiry-date",
      "issuing-authority",
      "nationality",
    ],
    timeout: 60,
    rule: null,
    meta_data: null,
    complete: null,
    result: null,
    result_string: null,
    result_data: null,
    error: null,
  }

  let verification = await Axios({
    method: 'POST',
    url: `${process.env.GOVERNMENT_API}/api/verifications`,
    headers: { 
      "x-api-key": process.env.GOVERNMENT_APIKEY
    },
    data: verificationData,
  })

  const verificationId = verification.data.verification_id

  let x = 0
  while (verification.data.complete !== true && x < 720) {
  function sleep(ms) {
    return new Promise(resolveFunc => setTimeout(resolveFunc, ms));
  }

  await sleep(5000);

  verification = await Axios({
    method: 'GET',
    url: `${process.env.GOVERNMENT_API}/api/verifications/${verificationId}`,
    headers: { 
      "x-api-key": process.env.GOVERNMENT_APIKEY
    },
  })

  x++
  }

  if (verification.data.complete === true) {
    console.log('Verification response:', verification.data)
    res.status(200).send(verification.data)
  } else {
    res.status(400).send({message: "Verification could not be processed"})
  }
})

// QR code
app.post('/api/invitations', (req, res) => {
  Axios({
    method: 'POST',
    url: `${process.env.GOVERNMENT_API}/api/invitations`,
    data: {
      contact_id: "",
      alias: "API Invitation",
      invitation_type: "CV1",
      invitation_mode: "once",
      accept: "auto",
      public: false,
      invitation_role: "Holder",
      invitation_label: "CV1",
      invitation_status: "active",
      invitation_description: "Invitation created through API",
      invitation_active_starting_at: null,
      invitation_active_ending_at: null,
      uses_allowed: ""
    },
    headers: {
      "x-api-key": process.env.GOVERNMENT_APIKEY
    },
  }).then(invitation => {
    res.status(200).send(invitation.data)

  }).catch(err => {
    console.error(err)
    res.status(500).json({message: 'Failed to retrieve invitation!', error: err})
  })
})

// requests presenation of credential
app.get('/api/verifications/:id', (req, res) => {
  const connectionID = req.params.id
  let focusInterval;

  const newFocusTimeout = setTimeout(() => {
    clearInterval(focusInterval)
    focusInterval = setInterval(intCallback, 30000)
    
  }, 1000 * 60 * 2)

  const clearVerTimeout = setTimeout(() => {
    clearInterval(intervalVerify)

  }, 1000 * 60 * 30)

  const clearAll = () => {
    clearTimeout(newFocusTimeout)
    clearTimeout(clearVerTimeout)
    clearInterval(focusInterval)
  }

  const intCallback = () => {
     Axios({
      method: 'GET',
      // we want to hit this path to get the request for presentation
      url: `${process.env.GOVERNMENT_API}/api/verification/${connectionID}`,
    }).then(verResponse => {
      if (verResponse.data.proof_status === 'verified' && verResponse.data.result) {

        clearAll()
        res.status(200).send(verResponse.data)
      } else if (verResponse.data.proof_status === 'verified' && !verResponse.data.result) {

        clearAll()
        res.status(401).json({message: "Health Credentials could not be verified!", error: ''})
      }
    }).catch(err => {
      console.error(err)
      
      clearAll()
      res.status(500).json({message: 'Verification Failed!', error: err})
    })
  }

  focusInterval = setInterval(intCallback, 5000)
})

app.use('/', (req, res) => {
  console.log('Request outside of normal paths', req.url)
  console.log(req.body)
  res.status(404).send()
})
