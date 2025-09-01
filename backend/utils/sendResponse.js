import { v4 as uuidv4 } from 'uuid';
import { getErrorByCode, createErrorResponse } from './errorCodes.js';
import { logInfo, logError } from './logger.js';

// Standard response function
const sendResponse = (res, statusCode, success, message, data = null, requestId = null) => {
  const responseId = requestId || uuidv4();
  
  const response = {
    success,
    message,
    requestId: responseId,
    timestamp: new Date().toISOString(),
    ...(data !== null && { data }), // adds `data` only if not null
  };

  // Log the response
  if (success) {
    logInfo(`Response sent: ${message}`, {
      statusCode,
      requestId: responseId,
      endpoint: res.req?.originalUrl,
      method: res.req?.method
    });
  } else {
    logError(`Error response: ${message}`, null, {
      statusCode,
      requestId: responseId,
      endpoint: res.req?.originalUrl,
      method: res.req?.method
    });
  }

  return res.status(statusCode).json(response);
};

// Enhanced response function with error codes
const sendErrorResponse = (res, errorCode, additionalData = {}, requestId = null) => {
  const error = getErrorByCode(errorCode);
  const responseId = requestId || uuidv4();
  
  const response = createErrorResponse(errorCode, responseId, additionalData);
  response.timestamp = new Date().toISOString();
  
  // Log the error response
  logError(`Error response: ${error.userMessage}`, null, {
    errorCode,
    statusCode: error.httpStatus,
    requestId: responseId,
    endpoint: res.req?.originalUrl,
    method: res.req?.method,
    additionalData
  });
  
  return res.status(error.httpStatus).json(response);
};

// Success response helper
const sendSuccessResponse = (res, message, data = null, statusCode = 200, requestId = null) => {
  return sendResponse(res, statusCode, true, message, data, requestId);
};

export { sendResponse, sendErrorResponse, sendSuccessResponse };
export default sendResponse;
