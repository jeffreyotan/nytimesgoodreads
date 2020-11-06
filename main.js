// load lobraries and modules
const express = require('express');
const handlebars = require('express-handlebars');
const fetch = require('node-fetch');
const withQuery = require('with-query').default;
const mysql = require('mysql2/promise');
const morgan = require('morgan');

// configure the port to listen to, with default being 3000
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000;

const APIKEY = process.env.APIKEY || "";
const QUERYLIMIT = parseInt(process.env.DB_QUERY_LIMIT) || 10;
const row1 = ["A", "B", "C", "D", "E"];
const row2 = ["F", "G", "H", "I", "J"];
const row3 = ["K", "L", "M", "N", "O"];
const row4 = ["P", "Q", "R", "S", "T"];
const row5 = ["U", "V", "W", "X", "Y"];
const row6 = ["Z"];
const row7 = ["0", "1", "2", "3", "4"];
const row8 = ["5", "6", "7", "8", "9"];

const SQL_QUERY_BOOK_LIST = "select * from book2018 where title like '?%' order by title asc limit ?;";

// create instance of the express server
const app = express();

// configure handlebars to work with express
app.engine('hbs', handlebars({ defaultLayout: 'default.hbs' }));
app.set('view engine', 'hbs');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PW,
    database: process.env.DB_NAME || 'goodreads',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 4,
    timezone: '+08:00'
});

const startApp = async (newApp, newPool) => {
    try {
        const conn = await newPool.getConnection();
        console.info('We are pinging the database..');

        await conn.ping();

        // after confirming that the connection can be established, release the connection back to reserve
        conn.release();

        // start the express server
        newApp.listen(PORT, () => {
            console.info(`Server was started at port ${PORT} on ${new Date()}`);
        });
    } catch(e) {
        console.error("Cannot ping database.. ", e);
    }
};

// set up the routes using middlewares
// set up morgan for logging HTTP requests.. the first route as all HTTP requests must be logged
app.use(morgan('combined'));

app.get('/', (req, res, next) => {
    res.status(200).type('text/html');
    res.render('index', { row1, row2, row3, row4, row5, row6, row7, row8 });
});

app.get('/books/:bookLtr', async (req, res, next) => {
    const bookStartLtr = req.params['bookLtr'];
    let currOffset = req.query['offset'];

    if(req.query['btnPressed'] === 'prev') {
        currOffset = Math.max(0, currOffset - QUERYLIMIT);
    } else if(req.query['btnPressed'] === 'next') {
        currOffset += QUERYLIMIT;
    }
    console.info("==> New Current Offset: ", currOffset);
});

console.info(`==> APIKEY: ${APIKEY}`);
// start the server
if(APIKEY) {
    startApp(app, pool);
} else {
    console.error('API Key was not set.. Please set key before starting server');
}
