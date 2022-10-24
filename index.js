require("dotenv").config();

const Axios = require("axios");
const bodyParser = require("body-parser");
const express = require("express");
const http = require("http");

// Import environment variables for use via an .env file in a non-containerized context
const dotenv = require("dotenv");
dotenv.config();

let app = express();
let server = http.createServer(app);

module.exports.server = server;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

server.listen(process.env.CONTROLLERPORT || 3100, () =>
  console.log(
    `Server listening at http://localhost:${
      process.env.CONTROLLERPORT || 3100
    }`,
    `\n Agent Address: ${process.env.AGENTADDRESS || "localhost:8150"}`
  )
);

//(AmmonBurgi) Set server timeout to support the prolonged requests on verification.
server.setTimeout(1000 * 60 * 35);

// app.post('/api/credentials', (req, res) => {
//   const credentialData = req.body

//   Axios({
//       method: 'POST',
//       url: `${process.env.BOARDING_PASS_ISSUER_API}/api/credentials`,
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

app.post("/api/verifications", async (req, res) => {
  //TODO: Create a schema array

  const schemas = [
    {
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
    },
    {
      schema_id: process.env.SCHEMA_TRUSTED_TRAVELER,
      schema_attributes: [
        "traveler_email",
        "credential_issue_date",
        "credential_issuer_name",
        "traveler_date_of_birth",
        "traveler_gender_legal",
        "governance_applied",
        "trusted_traveler_issue_date_time",
        "traveler_origin_country",
        "traveler_given_names",
        "trusted_traveler_expiration_date_time",
        "traveler_surnames",
        "traveler_country",
        "trusted_traveler_id",
      ],
    },
  ];

  const data = req.body;
  const verificationData = {
    connection_id: data.connection_id,
    contact_id: data.contact_id,
    invitation_id: data.invitation_id,
    schemas: schemas,
    timeout: 60,
    rule: null,
    meta_data: null,
    complete: null,
    result: null,
    result_string: null,
    result_data: null,
    error: null,
  };

  let verification = await Axios({
    method: "POST",
    url: `${process.env.BOARDING_PASS_ISSUER_API}/api/verifications`,
    data: verificationData,
  });
  let verificationResponse = verification.data;

  let verificationComplete = await verificationResponse.every((record) => {
    return record.complete === true;
  });

  let x = 0;
  while (verificationComplete !== true && x < 720) {
    function sleep(ms) {
      return new Promise((resolveFunc) => setTimeout(resolveFunc, ms));
    }

    await sleep(5000);

    let newVerificationResponse = [];
    await Promise.all(
      verificationResponse.map(async (verRecord) => {
        let verificationRecord = await Axios({
          method: "GET",
          url: `${process.env.BOARDING_PASS_ISSUER_API}/api/verifications/${verRecord.verification_id}`,
        });

        newVerificationResponse.push(verificationRecord.data);
      })
    );

    verificationResponse = newVerificationResponse;

    verificationComplete = newVerificationResponse.every((record) => {
      return record.complete === true;
    });

    x++;
  }

  if (verificationComplete === true) {
    console.log("Verification response:", verification.data);
    res.status(200).send(verification.data);
  } else {
    res.status(400).send({ message: "Verification could not be processed" });
  }
});

// QR code
app.post("/api/invitations", (req, res) => {
  Axios({
    method: "POST",
    url: `${process.env.BOARDING_PASS_ISSUER_API}/api/invitations`,
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
      uses_allowed: "",
    },
  })
    .then((invitation) => {
      res.status(200).send(invitation.data);
    })
    .catch((err) => {
      console.error(err);
      res
        .status(500)
        .json({ message: "Failed to retrieve invitation!", error: err });
    });
});

app.use("/", (req, res) => {
  console.log("Request outside of normal paths", req.url);
  console.log(req.body);
  res.status(404).send();
});
