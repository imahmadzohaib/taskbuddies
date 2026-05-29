const mongoose = require("mongoose")

const applicationSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task",
    required: true
  },
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  message: {
    type: String,
    required: true
  },
  rate: {
    type: Number,
    required: true
  },
  estimatedTime: {
    type: String,
    default: ""
  },
  experience: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending"
  }
}, {
  timestamps: true
})

// One application per user per task
applicationSchema.index({ task: 1, applicant: 1 }, { unique: true })

module.exports = mongoose.model("Application", applicationSchema)
