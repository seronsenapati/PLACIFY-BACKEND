import openRouterAPI from "../utils/openRouterAPI.js";
import sendResponse from "../utils/sendResponse.js";

export const generateJobDescription = async (req, res) => {
  try {
    if (req.user.role !== "recruiter") {
      return sendResponse(
        res,
        403,
        false,
        "Only recruiters can generate job descriptions"
      );
    }

    const { title, skills } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return sendResponse(
        res,
        400,
        false,
        "Title is required and must be a non-empty string"
      );
    }

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return sendResponse(res, 400, false, "Skills must be a non-empty array");
    }

    if (skills.some((skill) => typeof skill !== "string" || !skill.trim())) {
      return sendResponse(
        res,
        400,
        false,
        "All skills must be non-empty strings"
      );
    }

    const prompt = `Generate a professional job description for a ${title} role requiring the following skills: ${skills.join(
      ", "
    )}. 
    Include sections for:
    1. Role Overview
    2. Key Responsibilities
    3. Required Skills & Qualifications
    4. Preferred Experience
    Make it concise but comprehensive.`;

    const response = await openRouterAPI.post("/chat/completions", {
      model: "openai/gpt-3.5-turbo", // You can replace with "anthropic/claude-3-haiku"
      messages: [
        {
          role: "system",
          content:
            "You are a professional job description writer who creates clear, engaging, and detailed job postings.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const generatedDescription = response.data?.choices?.[0]?.message?.content;

    if (!generatedDescription) {
      throw new Error("Invalid response from AI service");
    }

    return sendResponse(
      res,
      200,
      true,
      "Job description generated successfully",
      { generatedDescription }
    );
  } catch (error) {
    console.error("AI Job Gen Error:", error.response?.data || error.message);
    return sendResponse(res, 500, false, "AI service temporarily unavailable");
  }
};
