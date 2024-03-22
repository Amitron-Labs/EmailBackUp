require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
var base64  = require('base64-stream');
const AWS = require('aws-sdk');
var Joi = require('joi');
const fs = require('fs');
const path = require('path');
const { Stream } = require("stream");



const app = express();
var Imap = require("imap"),
  inspect = require("util").inspect;
const PORT = process.env.PORT;

let datatime_user;
let send_to_user;
let subject_user;
let send_from;
let cc_user;

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


const validationMiddleware = (req,res,next) =>{
  const schema =Joi.object().key({
    send_to: Joi.string().required(),
    datatime: Joi.string().required(),
    attachment: Joi.string().required(),
    subject: Joi.string().required(),
    cc: Joi.string().required(),
    bcc: Joi.string().required(),
    send_from: Joi.string().required(),
  })
  next();
}

function findAttachmentParts(struct, attachments) {
  attachments = attachments ||  [];
  for (var i = 0, len = struct.length, r; i < len; ++i) {
    if (Array.isArray(struct[i])) {
      findAttachmentParts(struct[i], attachments);
    } else {
      if (struct[i].disposition && ['INLINE', 'ATTACHMENT'].indexOf(struct[i].disposition.type) > -1) {
        attachments.push(struct[i]);
      }
    }
  }
  return attachments;
}

function buildAttMessageFunction(attachment) {
  var filename = attachment.params.name;
  var encoding = attachment.encoding;

  return function (msg, seqno) {
    var prefix = '(#' + seqno + ') ';
    msg.on('body', function(stream, info) {
      //Create a write stream so that we can stream the attachment to file;
      console.log(prefix + 'Streaming this attachment to file', filename, info);
      var writeStream = fs.createWriteStream(filename);
      writeStream.on('finish', function() {
        console.log(prefix + 'Done writing to file %s', filename);
      });

      //stream.pipe(writeStream); this would write base64 data to the file.
      //so we decode during streaming using 
      if (toUpper(encoding) === 'BASE64') {
        //the stream is base64 encoded, so here the stream is decode on the fly and piped to the write stream (file)
        stream.pipe(base64.decode()).pipe(writeStream);
      } else  {
        //here we have none or some other decoding streamed directly to the file which renders it useless probably
        stream.pipe(writeStream);
      }
    });
    msg.once('end', function() {
      console.log(prefix + 'Finished attachment %s', filename);
    });
  };
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
            // let val = inspect(Imap.parseHeader(buffer))
            // let val  = JSON.stringify(inspect(Imap.parseHeader(buffer)))
            // console.log("JAYANT END",val);
            let red = buffer

            console.log("msg",msg);
            console.log("red",red);

            //Extract "CC:" attribute 
            let string_length = "CC:";
            cc_user = red.slice(red.indexOf("CC:") +3 + string_length.length,red.indexOf("\n"));

            //Extract "From" attribute 
            string_length = "From:";
            send_from = red.slice(red.indexOf("From:") + string_length.length,red.indexOf("\n"));
            red = red.substr(red.indexOf("\n"),red.lastIndexOf("\n"));
            
            //Extract "To" attribute 
            string_length = "To:";
            send_to_user = red.slice(red.indexOf("To:")  + string_length.length,red.indexOf("Subject:") -1);
            send_to_user = send_to_user.split(',');
            red = red.substr(red.indexOf(">") + 1,red.lastIndexOf("\n"));

            //Extract "Subject" attribute 
            string_length = "Subject:"
            subject_user = red.slice(red.indexOf("Subject:") + string_length.length,red.indexOf("Date:") -1);
            red = red.substr(red.indexOf("Date:") -1,red.lastIndexOf("\n"));

            //Extract "Date" attribute 
            string_length = "Date:"
            datatime_user = red.slice(red.indexOf("Date:") + string_length.length,red.indexOf("\n") -1);

            console.log("send_from",send_from);
            console.log("subject_user",subject_user);
            console.log("send_to_user",send_to_user);
            console.log("datatime", datatime_user);
            console.log("red2",red);
            console.log("cc_user",cc_user);
           
          });
        });
        msg.once('attributes', function(attrs) {
          const attachment_data = findAttachmentParts(attrs.struct);
          console.log(`${prefix} uid=${attrs.uid} Has attachments: ${attachment_data.length}`);
          attachment_data.forEach((attachment)=>{
            /* 
          RFC2184 MIME Parameter Value and Encoded Word Extensions
                  4.Parameter Value Character Set and Language Information
          RFC2231 Obsoletes: 2184
          {
            partID: "2",
            type: "image",
            subtype: "jpeg",
            params: {
    X         "name":"________20.jpg",
              "x-apple-part-url":"8C33222D-8ED9-4B10-B05D-0E028DEDA92A"
            },
            id: null,
            description: null,
            encoding: "base64",
            size: 351314,
            md5: null,
            disposition: {
              type: "inline",
              params: {
    V           "filename*":"GB2312''%B2%E2%CA%D4%B8%BD%BC%FE%D2%BB%5F.jpg"
              }
            },
            language: null
          }   */  
          console.log(`${prefix} Fetching attachment $(attachment.params.name`)
          console.log(attachment.disposition.params["filename*"])
          const  filename = attachment.params.name // need decode disposition.params['filename*'] !!!
          const encoding = toUpper(attachment.encoding)
          //A6 UID FETCH {attrs.uid} (UID FLAGS INERNALDATE BODY.PEEK[{attchment.partID}])
          const f = imap.fetch(attrs.uid, {bodies: [attachment.partID]})
          f.on('message', (msg, seqno) =>{
            const prefix = `(#${seqno})`
            msg.on('body', (stream, info) =>{
              const writeStream = fs.createWriteStream(filename);
              writeStream.on('finish',() =>{
                console.log(`${prefix} Done writing to file ${filename}`)
              })
              if(encoding == 'BASE64') Stream.pipe(base64.decode()).pipe(writeStream)
              else stream.pipe(writeStream)
            })
          })
          })
          console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
          for (var i = 0, len=attachment_data.length ; i < len; ++i) {
            var attachment = attachment_data[i];
            /*This is how each attachment looks like {
                partID: '2',
                type: 'application',
                subtype: 'octet-stream',
                params: { name: 'file-name.ext' },
                id: null,
                description: null,
                encoding: 'BASE64',
                size: 44952,
                md5: null,
                disposition: { type: 'ATTACHMENT', params: { filename: 'file-name.ext' } },
                language: null
              }
            */
            console.log(prefix + 'Fetching attachment %s', attachment.params.name);
            var f = imap.fetch(attrs.uid , { //do not use imap.seq.fetch here
              bodies: [attachment.partID],
              struct: true
            });
            //build function to process attachment message
            f.on('message', buildAttMessageFunction(attachment));
          }
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

//Function to insert data in to MongoDB
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
