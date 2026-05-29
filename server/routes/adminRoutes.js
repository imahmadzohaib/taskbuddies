const express = require("express")
const User = require("../models/user")
const Task = require("../models/task")
const auth = require("../middleware/authMiddleware")
const admin = require("../middleware/adminMiddleware")

const router = express.Router()

router.get("/dashboard", auth, admin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments()
    const totalTasks = await Task.countDocuments()
    const openTasks = await Task.countDocuments({ status: "open" })

    res.json({ totalUsers, totalTasks, openTasks })
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
})

router.get("/users", auth, admin, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 })
    res.json(users)
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
})

router.delete("/users/:id", auth, admin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id)
    res.json({ message: "User removed" })
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
})

router.get("/tasks", auth, admin, async (req, res) => {
  try {
    const tasks = await Task.find().populate("postedBy", "name email").sort({ createdAt: -1 })
    res.json(tasks)
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
})

router.delete("/tasks/:id", auth, admin, async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id)
    res.json({ message: "Task removed" })
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
