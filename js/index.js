//require('newrelic');

const cron = require("node-cron");
const express = require("express");
const config = require('./config.json');
let cycleSync = require("./entitysync").cycleSync;
let args = process.argv.slice(2);
let app = express();

if (args.length === 1) {

    if (args[0] === "server") {
  
        app.get('/', (req, res) => res.send('CMDB ENTITY SYNC'));

        // execute the daily run of the entity sync for each entity type/domain
        cron.schedule("0 " +  config.daily_sync_time + " * * *", function() {

            console.log("running cron cycle");
            cycleSync(config);
        });
  
      // start http listener
      app.listen(config.express_port);
  
    } //if
    else if (args[0] === "single-run") {
  
        console.log("running single cycle");
        cycleSync(config);
  
    } //else if
    else {
  
        console.log("UNKNOWN COMMAND: CMDB Sync requires server, single-run command line parameter.");
    } //else
  } //if
  else {
  
    console.log("UNKNOWN COMMAND: CMDB Sync requires server, single-run command line parameter.");
  } //else