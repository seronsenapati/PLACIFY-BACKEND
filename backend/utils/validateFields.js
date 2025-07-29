const validateFields = (requiredFields, data) => {
  const missing = [];

  for (let field of requiredFields) {
    if (!data[field] || data[field].toString().trim() === "") {
      missing.push(field);
    }
  }

  return {
    isValid: missing.length === 0,
    missingFields: missing,
  };
};

export default validateFields;
