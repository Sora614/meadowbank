const express = require('express');
const app = express();
const sql = require('mssql');
const cors = require('cors');
const fetch = require('node-fetch').default;
const fs = require('fs');
const testBarcode = fs.readFileSync('server/testimg/barcode.png', { encoding: 'base64' });


const IdAnalyzer = require('idanalyzer2').default;
const { Scanner, Profile } = IdAnalyzer;

const router = express.Router();
require('dotenv').config();

app.use(express.static('public'));
app.use(cors({
    origin: 'meadowbank-ejh5aueyfpa8f9e7.centralus-01.azurewebsites.net',
    methods: ['POST','GET','OPTIONS'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const scanner = new Scanner(process.env.IDANALYZER_KEY);
scanner.throwApiException(true);
const profile = new Profile(Profile.SECURITY_LOW); 
scanner.setProfile(profile);

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

app.post('/scan-id', async (req, res) => {

  if (!req.body.image || typeof req.body.image !== 'string' || req.body.image.length < 100) {
    console.error("Invalid image input:", req.body.image);
    return res.status(400).json({ error: 'Invalid image input' });
  }
  const base64Image = req.body.image.replace(/^data:image\/jpeg;base64,/, '');

  console.log("Scan input type:", typeof base64Image);
  console.log("Scan input preview:", base64Image?.slice?.(0, 30));
  console.log("base64Image length:", base64Image.length);

  try {
    const result = await scanner.quickScan(
      testBarcode, {
      barcode: true
    });
    console.log("Raw scan result:", JSON.stringify(result, null, 2));

    const data = result.data || {};

    function getSafeValue(fieldArray) {
      const val = fieldArray?.[0]?.value;
      return typeof val === 'string' ? val : String(val || '');
    }

    const firstName = getSafeValue(data.firstName);
    const lastName = getSafeValue(data.lastName);
    const address1 = getSafeValue(data.address1);

    let city = getSafeValue(data.address2);
    if(typeof(city) == String){
      city = city.includes(',') ? city.split(',')[0].trim() : city;
    }
    const stateShort = getSafeValue(data.stateShort);

    let postcode = getSafeValue(data.postcode);
    if(typeof(postcode) == String){
      postcode = postcode.substring(0, 5);
    }

    res.json({firstName, lastName, address1, city, stateShort, postcode})

  } catch (err) {
    console.error("ID Analyzer error:", err.response?.data || err.message || err);
    console.error("Scan failed — raw error:", err);
    res.status(500).json({ error: 'ID scan failed' });
  }

});

module.exports = router;


