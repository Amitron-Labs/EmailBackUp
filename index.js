require("dotenv").config();
const Imap = require("node-imap");
const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const simpleParser = require("mailparser").simpleParser;
const AWS = require("aws-sdk");

let file_aws_name = [];
let object_id;
let file_upload_link = [];

const app = express();

// Create IMAP connection
const imap = new Imap({
  user: process.env.EMAIL,
  password: process.env.PASSWORD,
  host: "outlook.office365.com",
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

var userSchema = new mongoose.Schema({
  send_to: {
    type: Array,
    defaylt: [],
  },
  datatime: {
    type: String,
  },
  attachment: {
    type: Array,
    defaylt: [],
  },
  subject: {
    type: String,
  },

  send_from: {
    type: String,
  },
  message: {
    type: String,
  },
  cc_in_mail: {
    type: Array,
    defaylt: [],
  },
});

// Middleware to parse JSON bodies
app.use(express.json());

function uploadFileAws(file_name, file_link) {
  let fileName = `./data/${file_name}`;
  bucketName = process.env.BUCKET;
  const fileContent = fs.readFileSync(fileName);
  file_key = file_link;

  // configuring parameters
  var params = {
    Bucket: process.env.BUCKET,
    Body: fileContent,
    Key: file_key,
  };

  s3.upload(params, (err, data) => {
    if (err) {
      console.error("Error uploading file:", err);
    } else {
      console.log(`File upload successfully. ${data.Location}`);
      file_upload_link.push(data.Location);
    }
  });
  console.log("file_upload_link", file_upload_link);
}

// configuring the AWS environment
const s3 = new AWS.S3({
  accessKeyId: process.env.ACCESSKEYID,
  secretAccessKey: process.env.SECRETACCESSKEY,
});

// Function to fetch emails
const fetchEmails = () => {
  imap.connect();

  imap.once("ready", () => {
    imap.openBox("INBOX", true, (err, box) => {
      if (err) throw err;

      imap.search(["ALL"], (searchErr, results) => {
        if (searchErr) throw searchErr;

        const fetch = imap.fetch(results, { bodies: "", struct: true });
        fetch.on("message", (msg) => {
          msg.on("body", (stream, info) => {
            simpleParser(stream, (parseErr, parsed) => {
              if (parseErr) throw parseErr;

              console.log("Subject:", parsed.subject);
              console.log("From:", parsed.from.text);
              console.log("To:", parsed.to.text);
              console.log("CC:", parsed.cc.text);
              console.log("Date:", parsed.date);
              console.log("message", parsed.messageId);

              //   console.log('all', parsed.);
              object_id = insertData(
                parsed.date,
                parsed.to.text,
                parsed.subject,
                parsed.from.text,
                parsed.messageId,
                parsed.cc.text
              );
            });
          });
          msg.on("attributes", function (attrs) {
            const attachment_data = findAttachmentParts(attrs.struct);
            // console.log("attachment_data", attachment_data);
            attachment_data.forEach((attachment) => {
              console.log(attachment.disposition.params["filename*"]);
              const filename = attachment.params.name; // need decode disposition.params['filename*'] !!!
              const encoding = attachment.encoding;
              //A6 UID FETCH {attrs.uid} (UID FLAGS INERNALDATE BODY.PEEK[{attchment.partID}])
              const f = imap.fetch(attrs.uid, { bodies: [attachment.partID] });
              f.on("message", (msg, seqno) => {
                msg.on("body", (stream, info) => {
                  const writeStream = fs.createWriteStream(
                    `./data/${filename}`
                  );
                  writeStream.on("finish", () => {
                    let file_link = Date.now() + "_" + filename;

                    file_aws_name.push(file_link);
                    console.log("file_link", file_link);
                    file_upload_link.push(file_link);
                    uploadFileAws(filename, file_link);
                  });
                  if (encoding == "BASE64")
                    Stream.pipe(base64.decode()).pipe(writeStream);
                  else stream.pipe(writeStream);
                });
              });
            });
            for (var i = 0, len = attachment_data.length, r; i < len; ++i) {
              console.log("filename", attachment_data[i].params.name);
              
            }
          });
        });

        fetch.once("end", () => {
          imap.end();
        

        });
      });
    });
  });

  imap.once("error", (err) => {
    console.log(err);
  });

  imap.once("end", () => {
    console.log("Connection ended");
    console.log("file_aws_name", file_aws_name);
    // const objectIdString = object_id.toString();
    let updateData = { attachment : file_aws_name}
    const objectIdString = updateUserById(object_id,updateData)
    console.log("objectIdString",objectIdString );
    // updateData(object_id, file_aws_name);
    fs.readdir('./data/', (err, files) => {
      if (err) throw err;

      for (const file of files) {
          console.log(file + ' : File Deleted Successfully.');
          fs.unlinkSync('./data/'+file);
      }

    });
  });
};

//Function for updating the mongodb
async function updateUserById(userIdPromise, updateData) {
  try {
      const User = mongoose.model("emailbackup", userSchema);
      const userId = await userIdPromise; // Resolve the Promise to get the ObjectId
      console.log("updateData",updateData)
      const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
      if (updatedUser) {
          console.log('User updated successfully:', updatedUser);
      } else {
          console.log('User not found');
      }
  } catch (error) {
      console.error('Error updating user:', error);
  }
}

//Function to insert data in to MongoDB
async function insertData(
  datatime_user,
  send_to_user,
  subject_user,
  SEND_FROM,
  message,
  cc_in_mail
) {
  try {
    const User = mongoose.model("emailbackup", userSchema);
    console.log("datatime_linl", datatime_user);
    console.log("send_to_user", send_to_user);
    console.log("subject_link", subject_user);
    console.log("send_from_link", SEND_FROM);
    const result = await User.create({
      send_to: send_to_user,
      datatime: datatime_user,
      message: message,
      subject: subject_user,
      send_from: SEND_FROM,
      cc_in_mail: cc_in_mail,
    });
    console.log("result", result);
    return result._id.valueOf();
  } catch (error) {
    console.error("Error processing data:", error);
  }
}

function findAttachmentParts(struct, attachments) {
  attachments = attachments || [];
  for (var i = 0, len = struct.length, r; i < len; ++i) {
    if (Array.isArray(struct[i])) {
      findAttachmentParts(struct[i], attachments);
    } else {
      if (
        struct[i].disposition &&
        ["inline", "attachment"].indexOf(struct[i].disposition.type) > -1
      ) {
        attachments.push(struct[i]);
      }
    }
  }
  console.log("struct[i] and attachments ", attachments);
  return attachments;
}

fetchEmails();
