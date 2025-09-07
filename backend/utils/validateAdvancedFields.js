// Check if a string is a valid URL
const isValidURL = (url) => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

// Check if a string is a valid social media URL
const isValidSocialURL = (url, platform) => {
  if (!url) return true; // Not required
  
  try {
    const parsed = new URL(url);
    const validProtocols = ["http:", "https:"];
    
    if (!validProtocols.includes(parsed.protocol)) {
      return false;
    }
    
    // Platform-specific validation
    switch (platform.toLowerCase()) {
      case 'linkedin':
        return parsed.hostname.includes('linkedin.com');
      case 'twitter':
        return parsed.hostname.includes('twitter.com') || parsed.hostname.includes('x.com');
      case 'facebook':
        return parsed.hostname.includes('facebook.com');
      case 'instagram':
        return parsed.hostname.includes('instagram.com');
      default:
        return true; // Generic URL validation for other platforms
    }
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
 * Validates company-related fields
 * @param {Object} fields - Fields to validate
 * @returns {string[]} Array of error messages (if any)
 */
export const validateCompanyFields = ({ website, socialMedia }) => {
  const errors = [];

  if (website && !isValidURL(website)) {
    errors.push("Website must be a valid URL (http or https)");
  }
  
  // Validate social media URLs
  if (socialMedia) {
    if (socialMedia.linkedin && !isValidSocialURL(socialMedia.linkedin, 'linkedin')) {
      errors.push("LinkedIn URL must be a valid LinkedIn profile URL");
    }
    
    if (socialMedia.twitter && !isValidSocialURL(socialMedia.twitter, 'twitter')) {
      errors.push("Twitter URL must be a valid Twitter/X profile URL");
    }
    
    if (socialMedia.facebook && !isValidSocialURL(socialMedia.facebook, 'facebook')) {
      errors.push("Facebook URL must be a valid Facebook profile URL");
    }
    
    if (socialMedia.instagram && !isValidSocialURL(socialMedia.instagram, 'instagram')) {
      errors.push("Instagram URL must be a valid Instagram profile URL");
    }
  }

  return errors;
};