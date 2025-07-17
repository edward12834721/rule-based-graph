// models/Dataset.js
const mongoose = require("mongoose");

const datasetSchema = new mongoose.Schema(
  {
    tableName: { type: String, required: true },
    rowData: { type: Map, of: String, required: true },
    characterSet: [{ type: String }],
  },
  { timestamps: true }
);

// Rule-based tagging
const RULES = [
  { char: "P", keywords: ["planet", "mars", "venus", "jupiter", "saturn"] },
  { char: "C", keywords: ["color", "red", "blue", "green", "yellow"] },
  { char: "R", keywords: ["distance", "mile", "km", "lightyear"] },
  { char: "N", keywords: ["name", "title", "label"] },
  { char: "T", keywords: ["temperature", "hot", "cold"] },
];

// Function to extract characterSet from rowData
function extractCharacterSet(rowData) {
  let dataObj = rowData;

  // Convert Map to Object if needed
  if (rowData instanceof Map) {
    dataObj = Object.fromEntries(rowData);
  }

  const tags = new Set();
  const rowString = Object.values(dataObj || {}).join(" ").toLowerCase();

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (rowString.includes(keyword)) {
        tags.add(rule.char);
        break;
      }
    }
  }

  return Array.from(tags);
}
// Auto-generate characterSet before saving
datasetSchema.pre("save", function (next) {
  if (this.isModified("rowData")) {
    this.characterSet = extractCharacterSet(this.rowData);
  }
  next();
});

// Also handle updates
datasetSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();

  if (update?.rowData) {
    update.characterSet = extractCharacterSet(update.rowData);
    this.setUpdate(update);
  }

  next();
});

module.exports = mongoose.model("Dataset", datasetSchema);
