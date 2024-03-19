const mongoose = require('mongoose');
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
module.exports = mongoose.model("users",userSchema)
