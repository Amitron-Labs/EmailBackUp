require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const app = express();
var Imap = require("imap"),
  inspect = require("util").inspect;
const PORT = process.env.PORT;

let datatime_user;
let send_to_user;
let subject_user;

var imap = new Imap({
  user: process.env.SEND_FROM,
  password: process.env.PASSWORD,
  host: process.env.HOST,
  port: 993,
  tls: true,
});

//Middleware - Plugin
app.use(express.urlencoded({ extended: false }));

const url = process.env.URL;

const connectionParams = {
  // useNewUrlParser: true,
  // useUnifiedTopology: true
};
// Connection
mongoose
  .connect(url, connectionParams)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("Mongo Error", err));

// Middleware to parse JSON bodies
app.use(express.json());

const userSchema = new mongoose.Schema({
    send_to:{
      type:Array,
      "defaylt":[]
    },
    datatime:{
        type:String,
    },
    attachment:{
      type:Array,
      "defaylt":[]
    },
    subject:{
        type:String,
    },
    cc:{
      type:Array,
      "defaylt":[]
    },
    bcc:{
      type:Array,
      "defaylt":[]
    },
    send_from:{
      type:String,
    }
  })

//configuring the AWS environment
AWS.config.update({
    accessKeyId: process.env.ACCESSKEYID,
    secretAccessKey: process.env.SECRETACCESSKEY,
  });


var s3 = new AWS.S3();
var filePath = process.env.FILEPATH;

//configuring parameters
var params = {
    Bucket: process.env.BUCKET,
    Body : fs.createReadStream(filePath),
    Key : "folder/"+Date.now()+"_"+path.basename(filePath)
  };

async function insertBucket(){
    s3.upload(params, function (err, data) {
        //handle error
        if (err) {
          console.log("Error", err);
        }
      
        //success
        if (data) {
          console.log("Uploaded in:", data.Location);
        }
      });
}

async function fetchdata() {
  function openInbox(cb) {
    imap.openBox("INBOX", true, cb);
  }

  imap.once("ready", function () {
    openInbox(function (err) {
      if (err) throw err;
      var f = imap.seq.fetch("1:3", {
        bodies: "HEADER.FIELDS (FROM TO SUBJECT DATE)",
        struct: true,
      });
      f.on("message", function (msg, seqno) {
        console.log("Message #%d", seqno);
        var prefix = "(#" + seqno + ") ";
        msg.on("body", function (stream, info) {
          var buffer = "";
          stream.on("data", function (chunk) {
            buffer += chunk.toString("utf8");
          });
          stream.once("end", function () {
            console.log(
              prefix + "Parsed header: %s",
              inspect(Imap.parseHeader(buffer))
            );

            datatime_user = inspect(Imap.parseHeader(buffer)).slice(
              parseInt(inspect(Imap.parseHeader(buffer)).indexOf("date: [")) +
                7,
              parseInt(inspect(Imap.parseHeader(buffer)).lastIndexOf("]"))
            );
            send_to_user = inspect(Imap.parseHeader(buffer)).slice(
              parseInt(inspect(Imap.parseHeader(buffer)).indexOf("to: [")) + 5,
              parseInt(inspect(Imap.parseHeader(buffer)).lastIndexOf("]"))
            );
            subject_user = inspect(Imap.parseHeader(buffer)).slice(
              parseInt(
                inspect(Imap.parseHeader(buffer)).indexOf("subject: [")
              ) + 10,
              parseInt(inspect(Imap.parseHeader(buffer)).lastIndexOf("]"))
            );
            console.log("datatime", datatime_user);
            console.log("send_to", send_to_user);
            console.log("subject", subject_user);
            console.log("send_from", process.env.SEND_FROM);
          });
        });
      });
      f.once("error", function (err) {
        console.log("Fetch error: " + err);
      });
      f.once("end", function () {
        console.log("Done fetching all messages!");
        imap.end();
      });
    });
  });

  imap.once("error", function (err) {
    console.log(err);
  });

  imap.once("end", function () {
    console.log("Connection ended");
  });

  imap.connect();

  app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });
}

//Function to insert data inot MongoDB
async function insertData() {
  try {
    const User = mongoose.model("emailbackup", userSchema);
    console.log("datatime_linl", datatime_user);
    console.log("send_to_link", send_to_user);
    console.log("subject_link", subject_user);
    console.log("send_from_link", process.env.SEND_FROM);
    const result = await User.create({
      send_to: send_to_user,
      datatime: datatime_user,
      message_link: "message",
      subject: subject_user,
    });
    console.log("result", result);
  } catch (error) {
    console.error("Error processing data:", error);
  }
}
async function processData() {
  try {
    await fetchdata();
  } catch (error) {
    console.error("Error processing data:", error);
  } finally {
    // Close MongoDB connection
    await insertData();
    await insertBucket();
    mongoose.connection.close();
  }
}

processData();
