const express = require('express');
const router = express.Router();
const Dataset = require('../models/Dataset');
const Relationship = require('../models/Relationship');
const { requireAuth } = require('../middlewares/auth'); // import your middleware
const { requireRole } = require('../middlewares/role'); // import role middleware

// GET all datasets — accessible to Admin and Viewer
router.get('/', requireAuth, requireRole(['Admin', 'Viewer']), async (req, res) => {
  try {
    const datasets = await Dataset.find();
    res.json(datasets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET one dataset by ID (protected)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) return res.status(404).json({ error: 'Not found' });
    res.json(dataset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE dataset — Admin only
router.post('/', requireAuth, requireRole('Admin'), async (req, res) => {
  try {
    const { tableName, rowData, characterSet } = req.body;
    const newDataset = new Dataset({ tableName, rowData, characterSet });
    await newDataset.save();
    
    const relationships = await recalculateRelationshipsForDataset(newDataset._id);
    res.status(201).json(newDataset);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// Recalculate relationships for a dataset (internal function)
async function recalculateRelationshipsForDataset(datasetId) {
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) throw new Error("Dataset not found");

  const newRelationships = [];
  const dataEntries = Object.entries(dataset.rowData || {});

  for (let i = 0; i < dataEntries.length; i++) {
    for (let j = i + 1; j < dataEntries.length; j++) {
      newRelationships.push({
        source: dataEntries[i][0],
        target: dataEntries[j][0],
        datasetId: dataset._id,
      });
    }
  }

  await Relationship.deleteMany({ datasetId: dataset._id });
  await Relationship.insertMany(newRelationships);

  return newRelationships;
}

// UPDATE dataset — Admin only
router.put('/:id', requireAuth, requireRole('Admin'), async (req, res) => {
  const { id } = req.params;
  const { tableName, rowData } = req.body;

  try {
    const updatePayload = {};
    if (tableName !== undefined) updatePayload.tableName = tableName;
    if (rowData !== undefined) updatePayload.rowData = rowData;

    const updated = await Dataset.findByIdAndUpdate(
      id,
      updatePayload,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    // Recalculate relationships after update
    await recalculateRelationshipsForDataset(updated._id);

    // Emit socket update event
    const io = req.app.get('io');
    if (io) {
      io.emit('graphUpdated');
    }

    res.json(updated);
  } catch (err) {
    console.error('Failed to update dataset:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE dataset — Admin only
router.delete('/:id', requireAuth, requireRole('Admin'), async (req, res) => {
  try {
    const dataset = await Dataset.findByIdAndDelete(req.params.id);
    if (!dataset) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
