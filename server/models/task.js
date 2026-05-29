const mongoose = require("mongoose")

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  budget: { type: Number, required: true },
  image: { type: String, default: "" },
  phone: { type: String, required: true },
  location: { type: String, default: "" },
  skills: { type: String, default: "" },
  paymentType: { type: String, default: "fixed" },
  level: { type: String, default: "Any Level" },
  startDate: { type: String, default: "" },
  deadline: { type: String, default: "" },
  status: { type: String, default: "open" },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  }
}, {
  timestamps: true
})

module.exports = mongoose.model("Task", taskSchema)
