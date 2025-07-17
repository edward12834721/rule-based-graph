// models/Relationship.js
const mongoose = require('mongoose');

const RelationshipSchema = new mongoose.Schema({
  from: {
    tableName: String,
    rowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset' },
    column: String,
    value: String,
  },
  to: {
    tableName: String,
    rowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset' },
    column: String,
    value: String,
  },
  reason: String // optional, e.g. 'keyword match' or 'semantic link'
});

module.exports = mongoose.model('Relationship', RelationshipSchema);

