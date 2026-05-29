const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { OAuth2Client } = require("google-auth-library")

const User = require("../models/user")
const auth = require("../middleware/authMiddleware")

const router = express.Router()
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

// Helper to generate JWT
function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  )
}

// ─── REGISTER ────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, city, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" })
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" })
    }

    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      return res.status(400).json({ message: "Email already registered. Please sign in." })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = new User({
      name,
      email: email.toLowerCase(),
      phone: phone || "",
      city: city || "",
      password: hashedPassword
    })

    await user.save()

    const token = generateToken(user)

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        city: user.city,
        role: user.role,
        avatar: user.avatar
      }
    })

  } catch (err) {
    console.error("Register error:", err)
    res.status(500).json({ message: "Server error" })
  }
})

// ─── LOGIN ────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" })
    }

    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      return res.status(400).json({ message: "No account found with that email" })
    }

    if (!user.password) {
      return res.status(400).json({ message: "This account uses Google Sign-In. Please use Google to log in." })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect password" })
    }

    const token = generateToken(user)

    res.json({
      message: "Signed in successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        city: user.city,
        role: user.role,
        avatar: user.avatar
      }
    })

  } catch (err) {
    console.error("Login error:", err)
    res.status(500).json({ message: "Server error" })
  }
})

// ─── GOOGLE AUTH ──────────────────────────────────────────────
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" })
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    })

    const payload = ticket.getPayload()
    const { sub: googleId, email, name, picture } = payload

    // Find or create user
    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] })

    if (user) {
      // Update Google info if signing in via Google for first time
      if (!user.googleId) {
        user.googleId = googleId
        user.avatar = picture
        await user.save()
      }
    } else {
      // Create new user from Google
      user = new User({
        name,
        email: email.toLowerCase(),
        googleId,
        avatar: picture,
        password: null
      })
      await user.save()
    }

    const token = generateToken(user)

    res.json({
      message: "Signed in with Google",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        city: user.city,
        role: user.role,
        avatar: user.avatar
      }
    })

  } catch (err) {
    console.error("Google auth error:", err)
    res.status(401).json({ message: "Google sign-in failed. Please try again." })
  }
})

// ─── GET CURRENT USER ─────────────────────────────────────────
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password")
    if (!user) return res.status(404).json({ message: "User not found" })
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
