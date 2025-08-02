// Check if a string is a valid URL
const isValidURL = (url) => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

/**
 * Validates job-related fields like role, description, and salary
 * @param {Object} fields - Fields to validate
 * @returns {string[]} Array of error messages (if any)
 */
export const validateJobFields = ({ role, desc, salary }) => {
  const errors = [];

  if (role && role.trim().length < 3) {
    errors.push("Role must be at least 3 characters long");
  }

  if (desc && desc.trim().length < 20) {
    errors.push("Description must be at least 20 characters long");
  }

  if (salary !== undefined && (isNaN(salary) || Number(salary) < 0)) {
    errors.push("Salary must be a valid positive number");
  }

  return errors;
};

/**
 * Validates company-related fields like website
 * @param {Object} fields - Fields to validate
 * @returns {string[]} Array of error messages (if any)
 */
export const validateCompanyFields = ({ website }) => {
  const errors = [];

  if (website && !isValidURL(website)) {
    errors.push("Website must be a valid URL (http or https)");
  }

  return errors;
};
