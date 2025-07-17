const mongoose = require('mongoose');
require('dotenv').config();
require('./db');

const Dataset = require('./models/Dataset');
const Relationship = require('./models/Relationship');
const faker = require('faker');

const RULES = [
  { char: 'P', keywords: ['planet', 'mars', 'venus', 'jupiter', 'saturn'] },
  { char: 'C', keywords: ['color', 'red', 'blue', 'green', 'yellow'] },
  { char: 'R', keywords: ['distance', 'mile', 'km', 'lightyear'] },
  { char: 'N', keywords: ['name', 'title', 'label'] },
  { char: 'T', keywords: ['temperature', 'hot', 'cold'] },
];

function injectKeyword() {
  const rule = faker.random.arrayElement(RULES);
  const keyword = faker.random.arrayElement(rule.keywords);
  return { value: `random ${keyword}`, matchedChar: rule.char };
}

async function seed() {
  await Dataset.deleteMany({});
  await Relationship.deleteMany({});

  const allDatasets = [];

  // Create datasets
  for (let t = 1; t <= 5; t++) {
    const tableName = `Table_${t}`;
    for (let i = 0; i < 20; i++) {
      const row = {};
      const charSet = new Set();

      const colCount = faker.datatype.number({ min: 10, max: 15 });
      for (let c = 0; c < colCount; c++) {
        const key = `col_${c}`;
        let value;

        if (Math.random() < 0.4) {
          const injected = injectKeyword();
          value = injected.value;
          charSet.add(injected.matchedChar);
        } else {
          value = faker.lorem.words(2);
        }

        row[key] = value;
      }

      const createdRow = await Dataset.create({
        tableName,
        rowData: row,
        characterSet: [...charSet],
      });

      console.log(createdRow);

      allDatasets.push({ _id: createdRow._id, tableName, rowData: row });

      // --- Create intra-row relationships: relate one column to 3 others in the same row ---
      const columns = Object.keys(row);
      if (columns.length >= 4) {
        for (let fromCol of columns) {
          // Select 3 other columns randomly
          const otherCols = columns.filter(c => c !== fromCol);
          const relatedCols = faker.helpers.shuffle(otherCols).slice(0, 3);

          const relatedFields = relatedCols.map(col => ({
            tableName,
            rowId: createdRow._id,
            column: col,
            value: row[col],
          }));

          const relationship = await Relationship.create({
            from: {
              tableName,
              rowId: createdRow._id,
              column: fromCol,
              value: row[fromCol],
            },
            to: relatedFields[0], // You can create multiple relationship docs or customize
            reason: "intra-row",
          });

          console.log(relationship);

          // Optionally create more 'to' relationships or multiple Relationship docs per fromCol
          // For example:
          for (let i = 1; i < relatedFields.length; i++) {
            await Relationship.create({
              from: {
                tableName,
                rowId: createdRow._id,
                column: fromCol,
                value: row[fromCol],
              },
              to: relatedFields[i],
              reason: "intra-row",
            });
          }
        }
      }
    }
  }

  // --- Create inter-row/table relationships as before ---
  for (let i = 0; i < 100; i++) {
    const from = faker.random.arrayElement(allDatasets);
    const to = faker.random.arrayElement(allDatasets);

    if (from._id.equals(to._id)) continue;

    const fromCols = Object.keys(from.rowData);
    const toCols = Object.keys(to.rowData);

    if (fromCols.length === 0 || toCols.length === 0) continue;

    const fromCol = faker.random.arrayElement(fromCols);
    const toCol = faker.random.arrayElement(toCols);

    await Relationship.create({
      from: {
        tableName: from.tableName,
        rowId: from._id,
        column: fromCol,
        value: from.rowData[fromCol],
      },
      to: {
        tableName: to.tableName,
        rowId: to._id,
        column: toCol,
        value: to.rowData[toCol],
      },
      reason: "semantic", // optional
    });
  }

  console.log("Seeded datasets and both intra- and inter-row/table relationships.");
  mongoose.disconnect();
}


seed();