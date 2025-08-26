import sendResponse from "../utils/sendResponse.js";

// ✅ Registration validation middleware
export const validateRegistration = (req, res, next) => {
  let { name, email, password, username, role = "student" } = req.body;

  // Type check
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof username !== "string"
  ) {
    return sendResponse(res, 400, false, "Invalid input types");
  }

  // Trim and normalize
  name = name.trim();
  email = email.trim().toLowerCase();
  password = password.trim();
  username = username.trim();
  role = role.trim().toLowerCase();

  // Required fields
  if (!name || !email || !password || !username) {
    return sendResponse(
      res,
      400,
      false,
      "Name, username, email, and password are required"
    );
  }

  // Name validation
  const nameRegex = /^[a-zA-Z\s]{2,50}$/;
  if (!nameRegex.test(name)) {
    return sendResponse(
      res,
      400,
      false,
      "Name must be 2-50 characters and contain only letters and spaces"
    );
  }

  // Username validation (letters, numbers, underscore, 3–20 chars)
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return sendResponse(
      res,
      400,
      false,
      "Username must be 3-20 characters and contain only letters, numbers, or underscores"
    );
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return sendResponse(
      res,
      400,
      false,
      "Please provide a valid email address"
    );
  }

  // Password strength validation
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    return sendResponse(
      res,
      400,
      false,
      "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
    );
  }

  // Allowed roles
  const allowedRoles = ["student", "recruiter"];
  if (!allowedRoles.includes(role)) {
    return sendResponse(
      res,
      400,
      false,
      `Invalid role. Role must be one of: ${allowedRoles.join(", ")}`
    );
  }

  // Pass sanitized data forward
  req.body = { name, email, password, username, role };
  next();
};

// ✅ Login validation middleware
export const validateLogin = (req, res, next) => {
  let { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string") {
    return sendResponse(res, 400, false, "Invalid input types");
  }

  email = email.trim().toLowerCase();
  password = password.trim();

  if (!email || !password) {
    return sendResponse(res, 400, false, "Email and password are required");
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return sendResponse(
      res,
      400,
      false,
      "Please provide a valid email address"
    );
  }

  req.body = { email, password };
  next();
};
