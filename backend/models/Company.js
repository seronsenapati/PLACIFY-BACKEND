import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    desc: {
      type: String,
      required: true,
    },
    website: {
      type: String,
      required: true,
    },
    createdBy:{
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
