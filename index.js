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
let send_from;

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



//configuring the AWS environment
// AWS.config.update({
//     accessKeyId: process.env.ACCESSKEYID,
//     secretAccessKey: process.env.SECRETACCESSKEY,
//   });


// var s3 = new AWS.S3();
// var filePath = process.env.FILEPATH;

//configuring parameters
// var params = {
//     Bucket: process.env.BUCKET,
//     Body : fs.createReadStream(filePath),
//     Key : "folder/"+Date.now()+"_"+path.basename(filePath)
//   };

// async function insertBucket(){
//     s3.upload(params, function (err, data) {
//         //handle error
//         if (err) {
//           console.log("Error", err);
//         }
      
//         //success
//         if (data) {
//           console.log("Uploaded in:", data.Location);
//         }
//       });
// }

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
            // let val = inspect(Imap.parseHeader(buffer))
            // let val  = JSON.stringify(inspect(Imap.parseHeader(buffer)))
            // console.log("JAYANT END",val);
            let red = buffer

            console.log("msg",msg);
            console.log("red",red);
            let string_length = "From:";
            send_from = red.slice(red.indexOf("From:") + string_length.length,red.indexOf("\n"));
            red = red.substr(red.indexOf("\n"),red.lastIndexOf("\n"));
            
            string_length = "To:";
            send_to_user = red.slice(red.indexOf("To:")  + string_length.length,red.indexOf("Subject:") -1);
            send_to_user = send_to_user.split(',');
            red = red.substr(red.indexOf(">") + 1,red.lastIndexOf("\n"));

            string_length = "Subject:"
            subject_user = red.slice(red.indexOf("Subject:") + string_length.length,red.indexOf("Date:") -1);
            red = red.substr(red.indexOf("Date:") -1,red.lastIndexOf("\n"));

            string_length = "Date:"
            datatime_user = red.slice(red.indexOf("Date:") + string_length.length,red.indexOf("\n") -1);

            console.log("send_from",send_from);
            console.log("subject_user",subject_user);
            console.log("send_to_user",send_to_user);
            console.log("datatime", datatime_user);
            console.log("red2",red);
            // console.log(Object.entries(red));
            // for (const [key, value] of Object.entries(red)) {
              // console.log(`${key}: ${value}`);
              //  if(key == 'to'){
              //     console.log(`${key}: ${value}`);
              //    send_to_user = value;
              //    console.log("send_to_user",send_to_user);
              //  }
              //    if(key == 'from'){
              //     console.log(`${key}: ${value}`);
              //    send_from = value[0];
              //    console.log("send_from",send_from);
              //  }
              //      if(key == 'subject'){
              //     console.log(`${key}: ${value}`);
              //    subject_user = value[0];
              //    console.log("subject_user",subject_user);
              //  }
              //       if(key == 'date'){
              //     console.log(`${key}: ${value}`);
              //     datatime_user = value[0];
              //    console.log("datatime",datatime_user);
              //  }
               
               
            //  }
          //   Object.entries(red).forEach(([key, value]) => {
          //     console.log(`${key}: ${value}`);
          // });
             
        //   Object.keys(red).forEach(key => {
        //     const value = red[key];
        //     console.log(`Key: ${key}, Value: ${value}`);
        // });
      //   Object.entries(red).map(entry => {
      //     let key = entry[0];
      //     let value = entry[1];
      //     console.log(key, value);
      // });

            // datatime_user = inspect(Imap.parseHeader(buffer)).slice(
            //   parseInt(inspect(Imap.parseHeader(buffer)).indexOf("date: [ '")) +9,
            //   parseInt(inspect(Imap.parseHeader(buffer)).lastIndexOf("' ],"))
            // );
            // send_to_user = inspect(Imap.parseHeader(buffer)).replace(">' ]\n}","").replace("<","").slice(
            //   parseInt(inspect(Imap.parseHeader(buffer)).indexOf("to: [")) + 5,
            //   parseInt(inspect(Imap.parseHeader(buffer)).lastIndexOf("]"))
            // );
            // subject_user = inspect(Imap.parseHeader(buffer)).slice(
            //   parseInt(
            //     inspect(Imap.parseHeader(buffer)).indexOf("   subject: [")
            //   ) + 13,
            //   parseInt(inspect(Imap.parseHeader(buffer)).lastIndexOf("],\n"))
            // );
            // console.log("datatime", datatime_user);
            // console.log("send_to", send_to_user);
            // console.log("subject", subject_user);
            // console.log("send_from", send_from);
          });
        });
        msg.once('attributes', function(attrs) {
          console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
        });
      });
      
      f.once("error", function (err) {
        console.log("Fetch error: " + err);
      });
      f.once("end", function () {
        console.log("Done fetching all messages!");
        console.log("datatime", datatime_user);
            console.log("send_to", send_to_user);
            console.log("subject", subject_user);
            console.log("send_from", send_from);
            //  insertData(datatime_user,send_to_user,subject_user,send_from);
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
async function insertData(datatime_user,send_to_user,subject_user,SEND_FROM) {
  try {
    const connectionParams = {
      // useNewUrlParser: true,
      // useUnifiedTopology: true
    };
    // Connection
    mongoose
      .connect(url, connectionParams)
      .then(() => console.log("MongoDB Connected"))
      .catch((err) => console.log("Mongo Error", err));
    var userSchema = new mongoose.Schema({
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
    const User = mongoose.model("emailbackup", userSchema);
    console.log("datatime_linl", datatime_user);
    console.log("send_to_user", send_to_user);
    console.log("subject_link", subject_user);
    console.log("send_from_link", SEND_FROM);
    const result = await User.create({
      send_to: send_to_user,
      datatime: datatime_user,
      message_link: "message",
      subject: subject_user,
      send_from: SEND_FROM,
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
   
    // await insertBucket();
    mongoose.connection.close();
  }
}

processData();
