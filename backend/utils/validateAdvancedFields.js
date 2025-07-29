const isValidURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateJobFields = ({ role, desc, salary }) => {
  const errors = [];

  if (role && role.length < 3) {
    errors.push("Role must be at least 3 characters");
  }

  if (desc && desc.length < 20) {
    errors.push("Description must be at least 20 characters");
  }

  if (salary && isNaN(salary)) {
    errors.push("Salary must be a valid number");
  }

  return errors;
};

export const validateCompanyFields = ({ website }) => {
  const errors = [];

  if (website && !isValidURL(website)) {
    errors.push("Website must be a valid URL");
  }

  return errors;
};
