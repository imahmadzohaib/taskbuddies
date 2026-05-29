const jwt = require("jsonwebtoken")

module.exports = function (req, res, next) {
  const authHeader = req.header("Authorization")

  if (!authHeader) {
    return res.status(401).json({ message: "No token, access denied" })
  }

  // Support both "Bearer <token>" and raw token
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    res.status(401).json({ message: "Token is not valid" })
  }
}
