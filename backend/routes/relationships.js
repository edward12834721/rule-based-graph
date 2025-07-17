// routes/relationships.js
const express = require("express");
const router = express.Router();
const Relationship = require("../models/Relationship");
const Dataset = require("../models/Dataset");

router.get("/graph", async (req, res) => {
  try {
    const relationships = await Relationship.find().lean();
    const datasets = await Dataset.find().lean();

    // Map datasets by tableName (assuming tableName is unique)
    const datasetMap = new Map(datasets.map(ds => [ds.tableName, ds]));

    const nodes = new Map();
    const links = [];

    relationships.forEach(rel => {      
      const fromId = `${rel.from.tableName}:${rel.from.rowId}:${rel.from.column}`;
      if (!nodes.has(fromId)) {
        const fromDataset = datasetMap.get(rel.from.tableName);
        nodes.set(fromId, {
          id: fromId,
          label: rel.from.value,
          group: rel.from.tableName,
          char: fromDataset?.characterSet?.join(", ") || "N/A",
        });
      }

      const toId = `${rel.to.tableName}:${rel.to.rowId}:${rel.to.column}`;
      if (!nodes.has(toId)) {
        const toDataset = datasetMap.get(rel.to.tableName);
        nodes.set(toId, {
          id: toId,
          label: rel.to.value,
          group: rel.to.tableName,
          char: toDataset?.characterSet?.join(", ") || "N/A",
        });
      }

      links.push({
        source: fromId,
        target: toId,
        reason: rel.reason || "N/A",
        value: 1,
      });
    });

    res.json({
      nodes: Array.from(nodes.values()),
      links,
    });
  } catch (err) {
    console.error("Error building graph:", err);
    res.status(500).json({ error: "Failed to generate graph." });
  }
});


module.exports = router;