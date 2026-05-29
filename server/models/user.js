const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    default: ""
  },
  city: {
    type: String,
    default: ""
  },
  password: {
    type: String,
    default: null  // null for Google-auth users
  },
  googleId: {
    type: String,
    default: null
  },
  avatar: {
    type: String,
    default: ""
  },
  role: {
    type: String,
    default: "user"
  }
}, {
  timestamps: true
})

module.exports = mongoose.model("User", userSchema)
