require('newrelic');

const cron = require("node-cron");
const express = require("express");
const config = require('./config.json');
let cycleSync = require("./entitysync").cycleSync;


//app = express();
//app.get('/', (req, res) => res.send('SNOW ENTITY SYNC'));

// execute the daily run of the entity sync for each entity type/domain
//cron.schedule("0 " +  config.daily_sync_time + " * * *", function() {

    console.log("running cycle");
    cycleSync(config);
//});

//app.listen(config.express_port);