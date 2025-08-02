import mongoose from "mongoose";
import sendResponse from "../utils/sendResponse.js";

/**
 * Middleware to validate MongoDB ObjectId parameters
 * @param {string} paramName - Name of the route param to validate
 */
export const validateObjectId = (paramName) => (req, res, next) => {
  const id = req.params[paramName];

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendResponse(res, 400, false, `Invalid ${paramName} format`);
  }

  next();
};

export default validateObjectId;
