const express = require("express")
const multer = require("multer")
const path = require("path")

const Task = require("../models/task")
const Application = require("../models/application")
const auth = require("../middleware/authMiddleware")

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
})
const upload = multer({ storage })

// ─────────────────────────────────────────────────────────────
// ROUTE ORDER RULES (Express matches top-to-bottom):
//   1. All static paths first  (/my, /create, /applications/...)
//   2. Dynamic :id paths last  (/:id, /:id/apply, /:id/applications)
//   3. module.exports at the END, never in the middle
// ─────────────────────────────────────────────────────────────

// ─── GET ALL OPEN TASKS (public) ─────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { category, search } = req.query
    let filter = { status: { $in: ["open"] } }
    if (category) filter.category = category
    if (search) filter.title = { $regex: search, $options: "i" }
    const tasks = await Task.find(filter)
      .populate("postedBy", "name city avatar")
      .sort({ createdAt: -1 })
    res.json(tasks)
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
})

// ─── GET MY POSTED TASKS (auth) ──────────────────────────────
router.get("/my", auth, async (req, res) => {
  try {
    const tasks = await Task.find({ postedBy: req.user.id }).sort({ createdAt: -1 })
    res.json(tasks)
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
})

// ─── CREATE TASK (auth) ──────────────────────────────────────
router.post("/create", auth, upload.single("image"), async (req, res) => {
  try {
    const task = new Task({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      budget: req.body.budget,
      phone: req.body.phone || "",
      location: req.body.location || "",
      skills: req.body.skills || "",
      paymentType: req.body.paymentType || "Fixed Price",
      level: req.body.level || "Any Level",
      startDate: req.body.startDate || "",
      deadline: req.body.deadline || "",
      image: req.file ? req.file.filename : "",
      postedBy: req.user.id
    })
    await task.save()
    res.status(201).json({ message: "Task posted successfully", task })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server error" })
  }
})

// ─── GET MY APPLICATIONS as worker (auth) ────────────────────
router.get("/applications/my", auth, async (req, res) => {
  try {
    const apps = await Application.find({ applicant: req.user.id })
      .populate("task", "title category budget location status deadline")
      .sort({ createdAt: -1 })
    res.json(apps)
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
})

// ─── WITHDRAW MY APPLICATION (worker) ────────────────────────
router.delete("/applications/:appId/withdraw", auth, async (req, res) => {
  try {
    const app = await Application.findById(req.params.appId)
    if (!app) return res.status(404).json({ message: "Application not found" })
    if (app.applicant.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" })
    if (app.status !== "pending")
      return res.status(400).json({ message: "Can only withdraw pending applications" })
    await Application.findByIdAndDelete(req.params.appId)
    res.json({ message: "Application withdrawn" })
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
})

// ─── ACCEPT APPLICANT (owner) ────────────────────────────────
router.patch("/applications/:appId/accept", auth, async (req, res) => {
  try {
    const app = await Application.findById(req.params.appId)
      .populate("task")
      .populate("applicant", "name email phone city")
    if (!app) return res.status(404).json({ message: "Application not found" })
    if (app.task.postedBy.toString() !== req.user.id)
      return res.status(403).json({ message: "Only the task owner can accept applicants" })
    if (app.task.status === "assigned")
      return res.status(400).json({ message: "This task already has an accepted worker" })

    app.status = "accepted"
    await app.save()

    // Delete all other pending applications for this task
    await Application.deleteMany({ task: app.task._id, _id: { $ne: app._id }, status: "pending" })

    // Mark task as assigned
    await Task.findByIdAndUpdate(app.task._id, { status: "assigned", acceptedBy: app.applicant._id })

    res.json({
      message: "Applicant accepted",
      worker: {
        name: app.applicant.name,
        email: app.applicant.email,
        phone: app.applicant.phone,
        city: app.applicant.city
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server error" })
  }
})

// ─── REJECT APPLICANT (owner) — deletes the application ──────
router.delete("/applications/:appId/reject", auth, async (req, res) => {
  try {
    const app = await Application.findById(req.params.appId).populate("task")
    if (!app) return res.status(404).json({ message: "Application not found" })
    if (app.task.postedBy.toString() !== req.user.id)
      return res.status(403).json({ message: "Only the task owner can reject applicants" })
    await Application.findByIdAndDelete(req.params.appId)
    res.json({ message: "Application rejected and removed" })
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
})

// ─── DELETE TASK (owner only) ─────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ message: "Task not found" })
    if (task.postedBy.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized to delete this task" })
    await Task.findByIdAndDelete(req.params.id)
    await Application.deleteMany({ task: req.params.id })
    res.json({ message: "Task deleted" })
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
})

// ─── SUBMIT APPLICATION (auth) ───────────────────────────────
router.post("/:id/apply", auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ message: "Task not found" })
    if (task.status !== "open") return res.status(400).json({ message: "This task is no longer open" })
    if (task.postedBy.toString() === req.user.id)
      return res.status(400).json({ message: "You cannot apply to your own task" })
    const existing = await Application.findOne({ task: req.params.id, applicant: req.user.id })
    if (existing) return res.status(400).json({ message: "You have already applied to this task" })
    const { message, rate, estimatedTime, experience } = req.body
    if (!message || !rate) return res.status(400).json({ message: "Message and rate are required" })
    const app = new Application({
      task: req.params.id,
      applicant: req.user.id,
      message,
      rate: Number(rate),
      estimatedTime: estimatedTime || "",
      experience: experience || ""
    })
    await app.save()
    res.status(201).json({ message: "Application submitted!", application: app })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: "You have already applied to this task" })
    res.status(500).json({ message: "Server error" })
  }
})

// ─── GET ALL APPLICANTS FOR A TASK (owner only) ───────────────
router.get("/:id/applications", auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ message: "Task not found" })
    if (task.postedBy.toString() !== req.user.id)
      return res.status(403).json({ message: "Only the task owner can view applicants" })
    const apps = await Application.find({ task: req.params.id })
      .populate("applicant", "name email phone city avatar")
      .sort({ createdAt: -1 })
    res.json(apps)
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
