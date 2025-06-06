const express = require('express');
const app = express();
const sql = require('mssql');
const cors = require('cors');

app.use(express.json());
app.use(cors({ origin: '*' }));

const config = {
  user: "ServerSubmit@meadowbank.database.windows.net",
  password: "MeadowbankCRUD123",
  server: "meadowbank.database.windows.net",
  database: "Meadowbank-SQL",
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

app.get('/data', async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query('SELECT * FROM Data');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send('Database error');
  } finally {
    await sql.close();
  }
});

app.post('/insert', async (req, res) => {

const { fname, lname, ssn, acctadd1, acctadd2, city, state, zipcode, initdep, accttype } = req.body;

  try {
    await sql.connect(config);
    await sql.query(`INSERT INTO Data VALUES ('${fname}','${lname}','${ssn}','${acctadd1}','${acctadd2}','${city}','${state}','${zipcode}',${initdep},'${accttype}');`);
    res.send('Data inserted successfully');
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).send(`Database error: ${err.message}`);
  } finally {
    await sql.close();
  }

});

app.listen(3000, () => console.log('Server running at http://localhost:3000'));

