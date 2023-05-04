require("dotenv").config();

const Axios = require("axios");
const bodyParser = require("body-parser");
const express = require("express");
const http = require("http");
const { DTC } = require("sita-dtc");
const { imageConversion } = require("jp2-to-jpeg");
const { DateTime } = require("luxon");

// Import environment variables for use via an .env file in a non-containerized context
const dotenv = require("dotenv");
dotenv.config();

let app = express();
let server = http.createServer(app);

module.exports.server = server;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(process.env.API_REQUEST_LIMIT ? bodyParser.json({limit: process.env.API_REQUEST_LIMIT}) : bodyParser.json());

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

app.post("/api/credentials", (req, res) => {
  const data = req.body;
  const credentialData = data.credentialData;

  const credentialAttributes = [
    {
      name: "passenger_given_names",
      value: credentialData["passenger_given_names"] || "", //DTC cred
    },
    {
      name: "passenger_family_names",
      value: credentialData["passenger_family_names"] || "", //DTC cred
    },
    {
      name: "passenger_image",
      value: credentialData["passenger_image"] || "", //DTC cred
    },
    {
      name: "airline_alliance",
      value: credentialData["airline_alliance"] || "",
    },
    {
      name: "passenger_tsa_precheck",
      value: credentialData["passenger_tsa_precheck"] || "",
    },
    {
      name: "pnr",
      value: credentialData["pnr"] || "",
    },
    {
      name: "ticket_eticket_number",
      value: credentialData["ticket_eticket_number"] || "",
    },
    {
      name: "ticket_designated_carrier",
      value: credentialData["ticket_designated_carrier"] || "",
    },
    {
      name: "ticket_operating_carrier",
      value: credentialData["ticket_operating_carrier"] || "",
    },
    {
      name: "ticket_flight_number",
      value: credentialData["ticket_flight_number"] || "",
    },
    {
      name: "ticket_class",
      value: credentialData["ticket_class"] || "",
    },
    {
      name: "ticket_seat_number",
      value: credentialData["ticket_seat_number"] || "",
    },
    {
      name: "ticket_exit_row",
      value: credentialData["ticket_exit_row"] || "",
    },
    {
      name: "ticket_origin",
      value: credentialData["ticket_origin"] || "",
    },
    {
      name: "ticket_destination",
      value: credentialData["ticket_destination"] || "",
    },
    {
      name: "ticket_luggage",
      value: credentialData["ticket_luggage"] || "",
    },
    {
      name: "ticket_special_service_request",
      value: credentialData["ticket_special_service_request"] || "",
    },
    {
      name: "ticket_with_infant",
      value: credentialData["ticket_with_infant"] || "",
    },
    {
      name: "boarding_gate",
      value: credentialData["boarding_gate"] || "",
    },
    {
      name: "boarding_zone_group",
      value: credentialData["boarding_zone_group"] || "",
    },
    {
      name: "boarding_secondary_screening",
      value: credentialData["boarding_secondary_screening"] || "",
    },
    {
      name: "boarding_date_time",
      value:
        Math.round(
          DateTime.fromISO(credentialData["boarding_date_time"]).ts / 1000
        ).toString() || "",
    },
    {
      name: "boarding_departure_date_time",
      value:
        Math.round(
          DateTime.fromISO(credentialData["boarding_departure_date_time"]).ts /
            1000
        ).toString() || "",
    },
    {
      name: "boarding_arrival_date_time",
      value:
        Math.round(
          DateTime.fromISO(credentialData["boarding_arrival_date_time"]).ts /
            1000
        ).toString() || "",
    },
    {
      name: "frequent_flyer_number",
      value: credentialData["frequent_flyer_number"] || "",
    },
    {
      name: "frequent_flyer_airline",
      value: credentialData["frequent_flyer_airline"] || "",
    },
    {
      name: "frequent_flyer_status",
      value: credentialData["frequent_flyer_status"] || "",
    },
    {
      name: "standby_status",
      value: credentialData["standby_status"] || "",
    },
    {
      name: "standby_boarding_date",
      value:
        Math.round(
          DateTime.fromISO(credentialData["standby_boarding_date"]).ts / 1000
        ).toString() || "",
    },
    {
      name: "standby_priority",
      value: credentialData["standby_priority"] || "",
    },
    {
      name: "sequence_number",
      value: credentialData["sequence_number"] || "",
    },
  ];

  const requestBody = {
    contact_id: data.contact_id || "",
    invitation_id: data.invitation_id || "",
    schema_id: process.env.SCHEMA_BOARDING_PASS,
    attributes: credentialAttributes,
  };

  Axios({
    method: "POST",
    url: `${process.env.BOARDING_PASS_ISSUER_API}/api/credentials`,
    data: requestBody,
    headers: {
      "x-api-key": process.env.BOARDING_PASS_ISSUER_APIKEY,
    },
  })
    .then((credResponse) => {
      if (credResponse.data.success) {
        res.status(200).send({ message: credResponse.data.success });
      } else {
        res
          .status(401)
          .json({ message: "Boarding Pass failed to issue!", error: "" });
      }
    })
    .catch((err) => {
      console.error(err);
      res
        .status(500)
        .json({ message: "Credentials issuance failed!", error: err });
    });
});

app.post("/api/verifications", async (req, res) => {
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
    contact_id: data.contact_id,
    invitation_id: data.invitation_id,
    schemas: schemas,
    timeout: 60,
    rule: null,
    meta_data: null,
  };

  console.log("---Requesting verification---");
  let verification = await Axios({
    method: "POST",
    url: `${process.env.BOARDING_PASS_ISSUER_API}/api/verifications`,
    data: verificationData,
    headers: {
      "x-api-key": process.env.BOARDING_PASS_ISSUER_APIKEY,
    },
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

    console.log("---Searching for completed verification records---");
    let newVerificationResponse = [];
    await Promise.all(
      verificationResponse.map(async (verRecord) => {
        let verificationRecord = await Axios({
          method: "GET",
          url: `${process.env.BOARDING_PASS_ISSUER_API}/api/verifications/${verRecord.verification_id}`,
          headers: {
            "x-api-key": process.env.BOARDING_PASS_ISSUER_APIKEY,
          },
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
    console.log(verificationResponse);
    const findResults = verificationResponse.filter(
      (record) => record.result === true
    );

    if (findResults.length === verificationResponse.length) {
      console.log(verificationResponse);
      const formattedResponse = verificationResponse.map((record) => {
        let newRecord = record;
        let newResultData = newRecord.result_data;

        // (AmmonBurgi) Find the verified DTC and convert the decoded image to a JPG...add it to the result data to pass back to the client
        for (let i = 0; i < newRecord.result_data.length; i++) {
          if (newRecord.result_data[i].name === "dtc") {
            const decodedDTC = new DTC({
              base64: newRecord.result_data[i].value,
            });
            const chipPhoto = decodedDTC.photo;
            const jpgPhoto = imageConversion(chipPhoto);
            newResultData = [
              ...newResultData,
              { name: "chip-photo", value: jpgPhoto },
            ];

            break;
          }
        }

        newRecord.result_data = newResultData;
        return newRecord;
      });

      res.status(200).send({ verificationRecords: formattedResponse });
    } else {
      res
        .status(401)
        .send({ message: "Your credentials could not be verified." });
    }
  } else {
    res.status(400).send({
      message: "Failed to complete verification process. Please try again.",
    });
  }
});

// QR code
app.post("/api/invitations", (req, res) => {
  console.log(process.env.BOARDING_PASS_ISSUER_API);
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
    headers: {
      "x-api-key": process.env.BOARDING_PASS_ISSUER_APIKEY,
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
