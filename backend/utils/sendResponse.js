const sendResponse = (res, statusCode, success, message, data = null) => {
  const response = {
    success,
    message,
    ...(data !== null && { data }), // adds `data` only if not null
  };

  return res.status(statusCode).json(response);
};

export default sendResponse;
