import { validationResult } from "express-validator";
import { v4 as uuidv4 } from 'uuid';
import { sendErrorResponse } from "../utils/sendResponse.js";

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map((err) => ({
      field: err.param,
      message: err.msg,
      value: err.value
    }));
    
    // Generate a request ID for tracking
    const requestId = uuidv4();
    
    return sendErrorResponse(
      res, 
      'VALIDATION_001', 
      { 
        errors: extractedErrors,
        message: 'Validation failed for one or more fields'
      }, 
      requestId
    );
  }
  next();
};

export default validateRequest;