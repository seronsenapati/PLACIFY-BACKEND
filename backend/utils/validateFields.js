/**
 * Validates required fields in a given data object.
 *
 * @param {string[]} requiredFields - List of required field names
 * @param {Object} data - The data object to validate
 * @returns {Object} Object with `isValid` boolean and array of `missingFields`
 */

const validateFields = (requiredFields, data) => {
  const missingFields = [];

  for (const field of requiredFields) {
    const value = data[field];

    // Allow boolean false and 0, but not null, undefined, or empty string
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "")
    ) {
      missingFields.push(field);
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};

export default validateFields;
