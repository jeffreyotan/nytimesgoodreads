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
const NYTBASEURL = 'https://api.nytimes.com/svc/books/v3/reviews.json';
const QUERYLIMIT = parseInt(process.env.DB_QUERY_LIMIT) || 10;
const row1 = ["A", "B", "C", "D", "E"];
const row2 = ["F", "G", "H", "I", "J"];
const row3 = ["K", "L", "M", "N", "O"];
const row4 = ["P", "Q", "R", "S", "T"];
const row5 = ["U", "V", "W", "X", "Y"];
const row6 = ["Z"];
const row7 = ["0", "1", "2", "3", "4"];
const row8 = ["5", "6", "7", "8", "9"];

const SQL_QUERY_BOOK_LIST = "select * from book2018 where title like ? order by title asc limit ? offset ?";
const SQL_QUERY_BOOK_COUNT = "select count(*) as numbooks from book2018 where title like ? order by title asc";
const SQL_QUERY_BOOK_DETAIL = "select * from book2018 where book_id like ?";

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
    let currOffset = parseInt(req.query['offset']) || 0;
    let hasPrev = true;
    let hasNext = true;

    if(req.query['btnPressed'] === 'prev') {
        currOffset = Math.max(0, currOffset - QUERYLIMIT);
    } else if(req.query['btnPressed'] === 'next') {
        currOffset += QUERYLIMIT;
    }
    console.info("==> New Current Offset: ", currOffset);

    const conn = await pool.getConnection();

    try {
        const counts = await conn.query(SQL_QUERY_BOOK_COUNT, [bookStartLtr + "%"]);
        console.info('==> Val of counts: ', counts[0]);
        const results = await conn.query(SQL_QUERY_BOOK_LIST, [bookStartLtr + "%", QUERYLIMIT, currOffset]);
        console.info('==> Val of results: ', results[0][0]);

        if((currOffset - QUERYLIMIT) < 0) {
            hasPrev = false;
        }
        if ((currOffset + QUERYLIMIT) > counts[0][0].numbooks ) {
            hasNext = false;
        }
        console.info(`==> Value of hasPrev is ${hasPrev} and hasNext is ${hasNext}`);

        res.format({
            default: () => {
                res.status(200).type('text/html');
                res.render('booklist', { alphabet: bookStartLtr, books: results[0], offset: currOffset, hasPrev, hasNext });
            }
        });
    } catch (error) {
        console.error("==> Error occurred while processing query:", error);
        res.status(500).type('text/html');
        res.send('<h1>Internal Server error occurred</h1>');
    } finally {
        conn.release();
    }
});

app.get('/books/:bookID/details', async (req, res, next) => {
    const bookID = req.params['bookID'];
    console.info(`==> The bookID obtained is ${bookID}`);

    const conn = await pool.getConnection();

    try {
        const results = await conn.query(SQL_QUERY_BOOK_DETAIL, [bookID]);
        console.info('==> Obtained book details: ', results[0]);
        const bookDetails = results[0][0];
        const neatAuthors = bookDetails.authors.split("|");
        const neatGenres = bookDetails.genres.split("|");
        console.info('==> neatGenres produced are: ', neatGenres);
        
        res.format({
            'text/html': () => {
                res.status(200).type('text/html');
                res.render('bookdetails', { imagesrc: bookDetails.image_url, pages: bookDetails.pages,
                    rating: bookDetails.rating, ratingcount: bookDetails.rating_count,
                    genres: neatGenres.join(", "), title: bookDetails.title,
                    authors: neatAuthors.join(", "), description: bookDetails.description, bookID
                });
            },
            'application/json': () => {
                const data = {
                    bookId: bookID,
                    title: bookDetails.title,
                    authors: neatAuthors,
                    summary: bookDetails.description,
                    pages: bookDetails.pages,
                    rating: parseFloat(bookDetails.rating),
                    ratingCount: bookDetails.rating_count,
                    genre: neatGenres
                };
                res.status(200).type('application/json');
                res.json(data);
            },
            default: () => {
                res.status(406).type('text/plain');
                res.send('Requested content type is not acceptable. Please change.');
            }
        });
    } catch (error) {
        console.error(`Unable to retrieve book details with ID: ${bookID}`);
        res.status(500).type('text/html');
        res.send('<h1>An Internal Server error occurred. Please try again.</h1>');
    }
});

app.get('/books/:title/reviews', async (req, res, next) => {
    const queryTitle = req.params['title'];
    const queryUrl = withQuery(
        NYTBASEURL, {
            "api-key": APIKEY,
            title: queryTitle
        }
    );

    const results = await fetch(queryUrl);
    try {
        const reviews = await results.json();
        console.info('==> NYT Query successful: ', reviews);
        
        res.format({
            default: () => {
                res.status(200).type('text/html');
                res.render('bookreviews', { hasReviews: reviews.num_results > 0, title: queryTitle,
                    review: reviews.results
                });
            }
        });
    } catch (error) {
        console.error('==> Error in requesting reviews: ', error);
        res.status(500).type('text/html');
        res.send('<h1>An Internal Server error occurred. Please try again.</h1>');
    }
});

console.info(`==> APIKEY: ${APIKEY}`);
// start the server
if(APIKEY) {
    startApp(app, pool);
} else {
    console.error('API Key was not set.. Please set key before starting server');
}
