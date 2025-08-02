import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 100,
    },
    desc: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 1000,
    },
    website: {
      type: String,
      required: true,
      match: [
        /^(https?:\/\/)?([\w\-]+\.)+[a-z]{2,}(:\d{1,5})?(\/.*)?$/i,
        "Please enter a valid website URL",
      ],
    },
    logo: {
      type: String,
      default: null, // Cloudinary URL
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    jobs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job",
      },
    ],
  },
  { timestamps: true }
);

const Company = mongoose.model("Company", companySchema);
export default Company;
