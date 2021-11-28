const express = require('express')
const pg = require('pg')
const _ = require('lodash')

const app = express()

// configs come from standard PostgreSQL env vars
// https://www.postgresql.org/docs/9.6/static/libpq-envars.html
const config = {
    max: 10,
    connectionString: process.env.CONNECTION_STRING
}
console.log("using postgres config : ", config)
const pool = new pg.Pool(config)

const queryHandler = (req, res, next) => {
    pool.query(req.sqlQuery).then((r) => {
        return res.json(r.rows || [])
    }).catch(next)
}

// API rate limit per second
const API_RATE_LIMIT = 10

app.get('/', _.throttle((req, res) => {
    res.send('Welcome to EQ Works 😎')
}, 1000 / API_RATE_LIMIT))

app.get('/events/hourly', _.throttle((req, res, next) => {
    req.sqlQuery = `
        SELECT date, hour, events
        FROM public.hourly_events
        ORDER BY date, hour
            LIMIT 168;
    `
    return next()
}, 1000 / API_RATE_LIMIT), queryHandler)

app.get('/events/daily', _.throttle((req, res, next) => {
    req.sqlQuery = `
        SELECT date, SUM (events) AS events
        FROM public.hourly_events
        GROUP BY date
        ORDER BY date
            LIMIT 7;
    `
    return next()
}, 1000 / API_RATE_LIMIT), queryHandler)

app.get('/stats/hourly', _.throttle((req, res, next) => {
    req.sqlQuery = `
        SELECT date, hour, impressions, clicks, revenue
        FROM public.hourly_stats
        ORDER BY date, hour
            LIMIT 168;
    `
    return next()
}, 1000 / API_RATE_LIMIT), queryHandler)

app.get('/stats/daily', _.throttle((req, res, next) => {
    req.sqlQuery = `
        SELECT date,
            SUM (impressions) AS impressions,
            SUM (clicks) AS clicks,
            SUM (revenue) AS revenue
        FROM public.hourly_stats
        GROUP BY date
        ORDER BY date
            LIMIT 7;
    `
    return next()
}, 1000 / API_RATE_LIMIT), queryHandler)

app.get('/poi', _.throttle((req, res, next) => {
    req.sqlQuery = `
        SELECT *
        FROM public.poi;
    `
    return next()
}, 1000 / API_RATE_LIMIT), queryHandler)

app.listen(process.env.APP_INTERNAL_PORT || 5555, (err) => {
    if (err) {
        console.error(err)
        process.exit(1)
    } else {
        console.log(`Running on internal port : ${process.env.APP_INTERNAL_PORT || 5555}`)
        console.log(`Clients must connect to : ${process.env.APP_PORT || 5555}`)
    }
})

// last resorts
process.on('uncaughtException', (err) => {
    console.log(`Caught exception: ${err}`)
    process.exit(1)
})
process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason)
    process.exit(1)
})
