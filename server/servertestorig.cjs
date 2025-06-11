const express = require('express');
const app = express();
const sql = require('mssql');
const cors = require('cors');
const fetch = require('node-fetch').default;

const validateAddress = async (street, street2, city, state, zip) => {

console.log(`${street} ${street2}, ${city}, ${state} ${zip}`);

try {
    const response = await fetch('https://api.postgrid.com/v1/addver/verifications', {
        method: 'POST',
        headers: {
            'x-api-key': 'live_sk_7hS1d5rjodBBF1DJb4YMQi',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            address: {
              line1: street,
              line2: street2,
              city: city,
              provinceOrState: state,
              postalCode: zip,
              country: 'US'
            }
        })
    });

    const data = await response.json();
    return data;
} catch (error) {
    return null;
}
};

app.use(express.json());
app.use(express.static('public'));
app.use(cors({
    origin: 'meadowbank-ejh5aueyfpa8f9e7.centralus-01.azurewebsites.net',
    methods: ['POST','GET','OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

process.on('uncaughtException', (err) => {
    console.error('Unhandled Error:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
});

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



app.use(express.static(__dirname + '/public'));
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));

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


  console.log("Validating address...");
  const validatedAddress = await validateAddress(`${acctadd1}`,`${acctadd2}`,`${city}`,`${state}`,`${zipcode}`);

  if (validatedAddress.data.postalOrZip != null) {

    console.log("Validated Address Object:", validatedAddress);

    const addressMatch = 
    validatedAddress.data.line1.toLowerCase().includes(acctadd1.toLowerCase()) &&
    validatedAddress.data.city.toLowerCase().includes(city.toLowerCase()) &&
    validatedAddress.data.postalOrZip.replace(/\s/g, '').toLowerCase() === zipcode.replace(/\s/g, '').toLowerCase();

    if (addressMatch){

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
    } else {

      res.json({
          original: { acctadd1, acctadd2, city, state, zipcode },
          validatedAddress,
          addressMatch
      });
    }

  } else {
      res.status(400).json(`Address verification failed, no match found.`);
  }
});

