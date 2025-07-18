const express = require('express');
const router = express.Router();
const Dataset = require('../models/Dataset');
const Relationship = require('../models/Relationship');
const faker = require('faker');
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

  await Relationship.deleteMany({ 'from.rowId': dataset._id });
  await Relationship.deleteMany({ 'to.rowId': dataset._id });
  
  // --- Create intra-row relationships: relate one column to 3 others in the same row ---
  const entries = Object.fromEntries(dataset.rowData.entries());
  const columns = Object.keys(entries);
  if (columns.length >= 4) {
    for (let fromCol of columns) {
      
      // Select 3 other columns randomly
      const otherCols = columns.filter(c => c !== fromCol);
      const relatedCols = faker.helpers.shuffle(otherCols).slice(0, 3);

      const relatedFields = relatedCols.map(col => ({
        tableName: dataset.tableName,
        rowId: dataset._id,
        column: col,
        value: entries[col],
      }));

      await Relationship.create({
        from: {
          tableName: dataset.tableName,
          rowId: dataset._id,
          column: fromCol,
          value: entries[fromCol],
        },
        to: relatedFields[0], // You can create multiple relationship docs or customize
        reason: "intra-row",
      });

      // Optionally create more 'to' relationships or multiple Relationship docs per fromCol
      // For example:
      for (let i = 1; i < relatedFields.length; i++) {
        await Relationship.create({
          from: {
            tableName: dataset.tableName,
            rowId: dataset._id,
            column: fromCol,
            value: entries[fromCol],
          },
          to: relatedFields[i],
          reason: "intra-row",
        });
      }
    }
  }

  const allDatasets = await Dataset.find({ _id: { $ne: datasetId } });
  const from = faker.random.arrayElement(allDatasets);
  const to = faker.random.arrayElement(allDatasets);

  // console.log('from:', from);
  // console.log('to:', to);

  if (dataset._id.equals(to._id) || dataset._id.equals(from._id))
    return;

  const myCols = entries;
  const fromCols = Object.fromEntries(from.rowData.entries());
  const toCols = Object.fromEntries(to.rowData.entries());

  if (fromCols.length === 0 || toCols.length === 0)
    return;

  const myCol = faker.random.arrayElement(Object.keys(myCols));
  const fromCol = faker.random.arrayElement(Object.keys(fromCols)); 
  const toCol = faker.random.arrayElement(Object.keys(toCols));
  // console.log('myCol:', myCol);
  // console.log('fromCol:', fromCol);
  // console.log('toCol:', toCol);
  // const myCol = faker.random.arrayElement(myCols);
  // const fromCol = faker.random.arrayElement(fromCols);
  // const toCol = faker.random.arrayElement(toCols);

  await Relationship.create({
    from: {
      tableName: dataset.tableName,
      rowId: dataset._id,
      column: myCol,
      value: myCols[myCol],
    },
    to: {
      tableName: to.tableName,
      rowId: to._id,
      column: toCol,
      value: toCols[toCol],
    },
    reason: "semantic", // optional
  });

  await Relationship.create({
    from: {
      tableName: from.tableName,
      rowId: from._id,
      column: fromCol,
      value: fromCols[fromCol],
    },
    to: {
      tableName: dataset.tableName,
      rowId: dataset._id,
      column: myCol,
      value: myCols[myCol],
    },
    reason: "semantic", // optional
  });
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
    await Relationship.deleteMany({ 'from.rowId': req.params.id });
    await Relationship.deleteMany({ 'to.rowId': req.params.id });

    const dataset = await Dataset.findByIdAndDelete(req.params.id);
    if (!dataset) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
