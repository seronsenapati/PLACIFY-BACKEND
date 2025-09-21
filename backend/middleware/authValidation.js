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
    return sendResponse(res, 400, false, "Invalid input types. All fields must be text.");
  }

  // Trim and normalize
  name = name.trim();
  email = email.trim().toLowerCase();
  password = password.trim();
  username = username.trim();
  role = role.trim().toLowerCase();

  // Required fields
  if (!name) {
    return sendResponse(
      res,
      400,
      false,
      "Please enter your full name."
    );
  }
  
  if (!username) {
    return sendResponse(
      res,
      400,
      false,
      "Please choose a username."
    );
  }
  
  if (!email) {
    return sendResponse(
      res,
      400,
      false,
      "Please enter your email address."
    );
  }
  
  if (!password) {
    return sendResponse(
      res,
      400,
      false,
      "Please create a password."
    );
  }

  // Name validation
  const nameRegex = /^[a-zA-Z\s]{2,50}$/;
  if (!nameRegex.test(name)) {
    return sendResponse(
      res,
      400,
      false,
      "Please enter a valid name (2-50 characters, letters and spaces only)."
    );
  }

  // Username validation (letters, numbers, underscore, 3–20 chars)
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return sendResponse(
      res,
      400,
      false,
      "Username must be 3-20 characters and contain only letters, numbers, or underscores."
    );
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return sendResponse(
      res,
      400,
      false,
      "Please enter a valid email address (example: user@domain.com)."
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
      "Password must be at least 8 characters with uppercase, lowercase, number, and special character."
    );
  }

  // Allowed roles
  const allowedRoles = ["student", "recruiter"];
  if (!allowedRoles.includes(role)) {
    return sendResponse(
      res,
      400,
      false,
      `Please select a valid role: ${allowedRoles.join(" or ")}.`
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
    return sendResponse(res, 400, false, "Email and password must be text.");
  }

  email = email.trim().toLowerCase();
  password = password.trim();

  if (!email) {
    return sendResponse(res, 400, false, "Please enter your email address.");
  }
  
  if (!password) {
    return sendResponse(res, 400, false, "Please enter your password.");
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return sendResponse(
      res,
      400,
      false,
      "Please enter a valid email address (example: user@domain.com)."
    );
  }

  req.body = { email, password };
  next();
};
